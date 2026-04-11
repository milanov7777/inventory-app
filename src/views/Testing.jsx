import { useState, useMemo } from 'react'
import { useTesting } from '../hooks/useTesting.js'
import { useApproved } from '../hooks/useApproved.js'
import { useOrders } from '../hooks/useOrders.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import Badge from '../components/Badge.jsx'
import SlidePanel from '../components/SlidePanel.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatDate, toISODate } from '../utils/formatDate.js'
import { notifySlack } from '../utils/slackNotify.js'
import { exportCsv } from '../utils/exportCsv.js'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'
import { canAdd, canEdit, canDelete, canPromote, isAdmin } from '../utils/permissions.js'

function ResultCell({ row, onQuickResult, readOnly }) {
  const v = row.pass_fail
  if (v) {
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${v === 'pass' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>
        {v.toUpperCase()}
      </span>
    )
  }
  if (readOnly) {
    return <span className="text-xs text-gray-400">Pending</span>
  }
  return (
    <div className="flex gap-1">
      <button onClick={(e) => { e.stopPropagation(); onQuickResult(row, 'pass') }}
        className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Pass</button>
      <button onClick={(e) => { e.stopPropagation(); onQuickResult(row, 'fail') }}
        className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Fail</button>
    </div>
  )
}

const filterFields = [
  { key: 'search', label: 'Search', type: 'text', placeholder: 'Search by SKU or compound...' },
  { key: 'pass_fail', label: 'Result', type: 'select', options: ['pass', 'fail'] },
  { key: 'lab', label: 'Lab', type: 'select', options: ['Freedom', 'Vanguard'] },
  { key: 'date_sent', label: 'Date Sent', type: 'date-range' },
]

const emptyForm = { batch_number: '', sku: '', compound_mg: '', lab: '', vials_sent: '', date_sent: toISODate(), date_results_received: '', pass_fail: '', coa_on_file: 'no', notes: '' }

export default function Testing({ user, session }) {
  const { testing, loading, error, addTesting, updateTesting, deleteTesting } = useTesting()
  const { approved } = useApproved()
  const { orders, refetch } = useOrders()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [promoteForm, setPromoteForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const approvedBatches = useMemo(() => new Set(approved.map((r) => r.batch_number)), [approved])
  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach((o) => { map[o.batch_number] = o })
    return map
  }, [orders])
  const orderStatusMap = useMemo(() => {
    const map = {}
    orders.forEach((o) => { map[o.batch_number] = o.status })
    return map
  }, [orders])

  const enriched = useMemo(() =>
    testing.map((r) => {
      const o = orderMap[r.batch_number] || {}
      return { ...r, _orderStatus: orderStatusMap[r.batch_number] || 'in_testing', vendor: o.vendor, unit_price: o.unit_price, total_value: o.total_value, qty_ordered: o.qty_ordered }
    }),
    [testing, orderMap, orderStatusMap]
  )

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      // Only show items currently at testing stage
      const status = orderStatusMap[row.batch_number]
      if (status && status !== 'in_testing') return false
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.pass_fail && row.pass_fail !== filters.pass_fail) return false
      if (filters.lab && row.lab?.toLowerCase() !== filters.lab.toLowerCase()) return false
      if (filters.date_sent_from && row.date_sent < filters.date_sent_from) return false
      if (filters.date_sent_to && row.date_sent > filters.date_sent_to) return false
      return true
    })
  }, [enriched, filters, orderStatusMap])

  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }))

  function openAdd() { setForm({ ...emptyForm }); setFormError(null); setPanelMode('add') }
  function openEdit(row) {
    setSelectedRow(row)
    setForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, lab: row.lab || '', vials_sent: row.vials_sent || '', date_sent: row.date_sent || toISODate(), date_results_received: row.date_results_received || '', pass_fail: row.pass_fail || '', coa_on_file: row.coa_on_file || 'no', notes: row.notes || '' })
    setFormError(null); setPanelMode('edit')
  }
  function openPromote(row) {
    setSelectedRow(row)
    setPromoteForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, qty_available: row.vials_sent || '', approved_date: toISODate(), storage: 'shelf', notes: '' })
    setFormError(null); setPanelMode('promote')
  }

  // Quick pass/fail — update the row inline
  async function handleQuickResult(row, result) {
    try {
      await supabase.from('testing').update({
        pass_fail: result,
        date_results_received: toISODate(),
      }).eq('id', row.id)
      if (result === 'fail') {
        await supabase.from('orders').update({ status: 'failed' }).eq('batch_number', row.batch_number)
      }
      await logAction({ userName: user, actionType: 'update', batchNumber: row.batch_number, stage: 'testing', changes: { pass_fail: result } })
      notifySlack('test_result', { batch_number: row.batch_number, result, user })
    } catch (err) {
      console.error('Quick result failed:', err)
    }
  }

  // Build columns with quick-result inline
  const columns = [
    { key: 'batch_number', label: 'Batch #', sticky: true },
    { key: 'sku', label: 'SKU' },
    { key: 'compound_mg', label: 'Compound & MG', bold: true },
    { key: 'vendor', label: 'Vendor' },
    { key: 'qty_ordered', label: 'Qty Ordered' },
    { key: 'unit_price', label: 'Unit Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
    { key: 'total_value', label: 'Total', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
    { key: 'lab', label: 'Lab' },
    { key: 'vials_sent', label: 'Vials' },
    { key: 'date_sent', label: 'Sent', render: (v) => formatDate(v) },
    { key: 'date_results_received', label: 'Results', render: (v) => formatDate(v) },
    { key: 'pass_fail', label: 'Result', render: (_, row) => <ResultCell row={row} onQuickResult={handleQuickResult} readOnly={!canEdit(session)} /> },
    { key: 'coa_on_file', label: 'COA', render: (v) => v ? v.toUpperCase() : '—' },
    { key: 'logged_by', label: 'By' },
    { key: 'status', label: 'Status', render: (_, row) => <Badge status={row._orderStatus} /> },
    { key: 'notes', label: 'Notes', truncate: true },
  ]

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...form, vials_sent: form.vials_sent ? Number(form.vials_sent) : null, date_sent: form.date_sent || null, date_results_received: form.date_results_received || null, pass_fail: form.pass_fail || null, lab: form.lab || null, logged_by: user }
      if (panelMode === 'add') await addTesting(payload, user)
      else {
        await updateTesting(selectedRow.id, payload, user, selectedRow.batch_number)
        if (payload.pass_fail === 'fail') {
          await supabase.from('orders').update({ status: 'failed' }).eq('batch_number', payload.batch_number)
          await refetch()
        }
      }
      if (payload.pass_fail && payload.pass_fail !== selectedRow?.pass_fail) {
        notifySlack('test_result', { batch_number: payload.batch_number, result: payload.pass_fail, user })
      }
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handlePromote(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...promoteForm, qty_available: Number(promoteForm.qty_available), logged_by: user }
      const { error: insertErr } = await supabase.from('approved').insert(payload)
      if (insertErr) throw new Error(insertErr.message)
      const { error: statusErr } = await supabase.from('orders').update({ status: 'approved' }).eq('batch_number', promoteForm.batch_number)
      if (statusErr) throw new Error(statusErr.message)
      await logAction({ userName: user, actionType: 'promote', batchNumber: promoteForm.batch_number, stage: 'approved', changes: { from: 'testing', to: 'approved', ...payload } })
      notifySlack('batch_approved', { batch_number: promoteForm.batch_number, user })
      await refetch()
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmRow) return
    try { await deleteTesting(confirmRow.id, confirmRow.batch_number, user) }
    catch (err) { console.error(err) } finally { setConfirmRow(null) }
  }

  function handleExport() {
    exportCsv(filtered, columns.filter((c) => c.key !== 'status').map((c) => ({ key: c.key, label: c.label })), 'testing.csv')
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  // Approve enabled if: pass OR user is Admin (manual override)
  const canApproveRow = (row) => {
    if (approvedBatches.has(row.batch_number)) return false
    return row.pass_fail === 'pass' || isAdmin(session)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Testing</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
          {canAdd(session) && <button onClick={openAdd} className="text-sm px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm">+ Add Testing</button>}
        </div>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
        <Table columns={columns} rows={filtered} onEdit={canEdit(session) ? openEdit : undefined} onDelete={canDelete(session) ? (row) => setConfirmRow(row) : undefined}
          onPromote={canPromote(session) ? openPromote : undefined} promoteLabel="Approve" promotedLabel="Approved ✓"
          canPromote={canApproveRow}
          emptyMessage="No testing records yet." />
      )}

      <SlidePanel isOpen={panelMode === 'add' || panelMode === 'edit'} onClose={() => setPanelMode(null)} title={panelMode === 'add' ? 'New Testing Record' : 'Edit Testing Record'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Batch #" required><input className={ic} value={form.batch_number} onChange={(e) => f('batch_number', e.target.value)} required placeholder="e.g. NV-P-XXXX" /></Field>
          <Field label="SKU" required><input className={ic} value={form.sku} onChange={(e) => f('sku', e.target.value)} required placeholder="e.g. P-010" /></Field>
          <Field label="Compound & MG" required><input className={ic} value={form.compound_mg} onChange={(e) => f('compound_mg', e.target.value)} required placeholder="e.g. HCG 750" /></Field>
          <Field label="Lab" required>
            <select className={ic} value={form.lab} onChange={(e) => f('lab', e.target.value)} required>
              <option value="">Select lab...</option>
              <option value="Freedom">Freedom</option>
              <option value="Vanguard">Vanguard</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vials Sent"><input type="number" min="0" className={ic} value={form.vials_sent} onChange={(e) => f('vials_sent', e.target.value)} placeholder="0" /></Field>
            <Field label="Date Sent"><input type="date" className={ic} value={form.date_sent} onChange={(e) => f('date_sent', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Results Received"><input type="date" className={ic} value={form.date_results_received} onChange={(e) => f('date_results_received', e.target.value)} /></Field>
            <Field label="Pass / Fail">
              <select className={ic} value={form.pass_fail} onChange={(e) => f('pass_fail', e.target.value)}>
                <option value="">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </Field>
          </div>
          <Field label="COA On File">
            <select className={ic} value={form.coa_on_file} onChange={(e) => f('coa_on_file', e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any additional notes..." /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving...' : panelMode === 'add' ? 'Add Record' : 'Save Changes'}</button>
          </div>
        </form>
      </SlidePanel>

      <SlidePanel isOpen={panelMode === 'promote'} onClose={() => setPanelMode(null)} title="Approve Batch">
        <form onSubmit={handlePromote} className="space-y-4">
          <Field label="Batch #"><input className={ic + ' bg-gray-50'} value={promoteForm.batch_number || ''} readOnly /></Field>
          <Field label="SKU"><input className={ic + ' bg-gray-50'} value={promoteForm.sku || ''} readOnly /></Field>
          <Field label="Compound & MG"><input className={ic + ' bg-gray-50'} value={promoteForm.compound_mg || ''} readOnly /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Available" required><input type="number" min="0" className={ic} value={promoteForm.qty_available || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, qty_available: e.target.value }))} required /></Field>
            <Field label="Approved Date" required><input type="date" className={ic} value={promoteForm.approved_date || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, approved_date: e.target.value }))} required /></Field>
          </div>
          <Field label="Storage" required>
            <select className={ic} value={promoteForm.storage || 'shelf'} onChange={(e) => setPromoteForm((p) => ({ ...p, storage: e.target.value }))}>
              <option value="shelf">Shelf</option>
              <option value="fridge">Fridge</option>
            </select>
          </Field>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={promoteForm.notes || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Approve Batch'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog isOpen={!!confirmRow} message={`Delete testing record for batch "${confirmRow?.batch_number}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setConfirmRow(null)} />
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, required, children }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
