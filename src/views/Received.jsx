import { useState, useMemo } from 'react'
import { useReceived } from '../hooks/useReceived.js'
import { useTesting } from '../hooks/useTesting.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import Badge from '../components/Badge.jsx'
import SlidePanel from '../components/SlidePanel.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatDate, toISODate } from '../utils/formatDate.js'
import { exportCsv } from '../utils/exportCsv.js'
import { notifySlack } from '../utils/slackNotify.js'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'
import { useOrders } from '../hooks/useOrders.js'

const columns = [
  { key: 'batch_number', label: 'Batch #', sticky: true },
  { key: 'sku', label: 'SKU' },
  { key: 'compound_mg', label: 'Compound & MG', bold: true },
  { key: 'vendor', label: 'Vendor' },
  { key: 'qty_ordered', label: 'Qty Ordered' },
  { key: 'unit_price', label: 'Unit Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'total_value', label: 'Total', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'qty_received', label: 'Qty Received' },
  { key: 'date_received', label: 'Received', render: (v) => formatDate(v) },
  { key: 'storage', label: 'Storage', render: (v) => v ? (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${v === 'fridge' ? 'bg-blue-500' : 'bg-gray-400'}`} />
      {v.charAt(0).toUpperCase() + v.slice(1)}
    </span>
  ) : '—' },
  { key: 'cap_color', label: 'Cap Color' },
  { key: 'logged_by', label: 'By' },
  { key: 'status', label: 'Status', render: (_, row) => <Badge status={row._orderStatus} /> },
  { key: 'notes', label: 'Notes', truncate: true },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Compound', type: 'text' },
  { key: 'storage', label: 'Storage', type: 'select', options: ['fridge', 'shelf'] },
  { key: 'date_received', label: 'Date Received', type: 'date-range' },
]

const emptyForm = { sku: '', compound_mg: '', qty_received: '', batch_number: '', date_received: toISODate(), storage: 'shelf', cap_color: '', notes: '' }

export default function Received({ user }) {
  const { received, loading, error, addReceived, updateReceived, deleteReceived } = useReceived()
  const { testing } = useTesting()
  const { orders, refetch } = useOrders()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [promoteForm, setPromoteForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const testingBatches = useMemo(() => new Set(testing.map((r) => r.batch_number)), [testing])
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
    received.map((r) => {
      const o = orderMap[r.batch_number] || {}
      return { ...r, _orderStatus: orderStatusMap[r.batch_number] || 'received', vendor: o.vendor, unit_price: o.unit_price, total_value: o.total_value, qty_ordered: o.qty_ordered }
    }),
    [received, orderMap, orderStatusMap]
  )

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      // Only show items currently at received stage — not already in testing/approved/on website
      const status = orderStatusMap[row.batch_number]
      if (status && status !== 'received') return false
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.storage && row.storage !== filters.storage) return false
      if (filters.date_received_from && row.date_received < filters.date_received_from) return false
      if (filters.date_received_to && row.date_received > filters.date_received_to) return false
      return true
    })
  }, [enriched, filters, orderStatusMap])

  function openAdd() { setForm({ ...emptyForm }); setFormError(null); setPanelMode('add') }
  function openEdit(row) {
    setSelectedRow(row)
    setForm({ sku: row.sku, compound_mg: row.compound_mg, qty_received: row.qty_received, batch_number: row.batch_number, date_received: row.date_received, storage: row.storage, cap_color: row.cap_color || '', notes: row.notes || '' })
    setFormError(null); setPanelMode('edit')
  }
  function openPromote(row) {
    setSelectedRow(row)
    setPromoteForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, vials_sent: '', date_sent: toISODate(), notes: '' })
    setFormError(null); setPanelMode('promote')
  }

  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }))

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...form, qty_received: Number(form.qty_received), logged_by: user }
      if (panelMode === 'add') await addReceived(payload, user)
      else await updateReceived(selectedRow.id, payload, user, selectedRow.batch_number)
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handlePromote(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...promoteForm, vials_sent: Number(promoteForm.vials_sent), coa_on_file: 'no', logged_by: user }
      const { error: insertErr } = await supabase.from('testing').insert(payload)
      if (insertErr) throw new Error(insertErr.message)
      const { error: statusErr } = await supabase.from('orders').update({ status: 'in_testing' }).eq('batch_number', promoteForm.batch_number)
      if (statusErr) throw new Error(statusErr.message)
      await logAction({ userName: user, actionType: 'promote', batchNumber: promoteForm.batch_number, stage: 'testing', changes: { from: 'received', to: 'testing', ...payload } })
      notifySlack('sent_to_testing', { batch_number: promoteForm.batch_number, user })
      await refetch()
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmRow) return
    try { await deleteReceived(confirmRow.id, confirmRow.batch_number, user) }
    catch (err) { console.error(err) } finally { setConfirmRow(null) }
  }

  function handleExport() {
    exportCsv(filtered, columns.filter((c) => c.key !== 'status').map((c) => ({ key: c.key, label: c.label })), 'received.csv')
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Received</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
          <button onClick={openAdd} className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm">+ Add Received</button>
        </div>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <Table columns={columns} rows={filtered} onEdit={openEdit} onDelete={(row) => setConfirmRow(row)}
          onPromote={openPromote} promoteLabel="Send to Testing" promotedLabel="Sent ✓"
          canPromote={(row) => !testingBatches.has(row.batch_number)}
          emptyMessage="No received items yet." />
      )}

      <SlidePanel isOpen={panelMode === 'add' || panelMode === 'edit'} onClose={() => setPanelMode(null)} title={panelMode === 'add' ? 'New Received Entry' : 'Edit Received Entry'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Batch #" required><input className={ic} value={form.batch_number} onChange={(e) => f('batch_number', e.target.value)} required /></Field>
          <Field label="SKU" required><input className={ic} value={form.sku} onChange={(e) => f('sku', e.target.value)} required /></Field>
          <Field label="Compound & MG" required><input className={ic} value={form.compound_mg} onChange={(e) => f('compound_mg', e.target.value)} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Received" required><input type="number" min="1" className={ic} value={form.qty_received} onChange={(e) => f('qty_received', e.target.value)} required /></Field>
            <Field label="Date Received" required><input type="date" className={ic} value={form.date_received} onChange={(e) => f('date_received', e.target.value)} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Storage" required>
              <select className={ic} value={form.storage} onChange={(e) => f('storage', e.target.value)}>
                <option value="shelf">Shelf</option>
                <option value="fridge">Fridge</option>
              </select>
            </Field>
            <Field label="Cap Color"><input className={ic} value={form.cap_color} onChange={(e) => f('cap_color', e.target.value)} /></Field>
          </div>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : panelMode === 'add' ? 'Add Entry' : 'Save Changes'}</button>
          </div>
        </form>
      </SlidePanel>

      <SlidePanel isOpen={panelMode === 'promote'} onClose={() => setPanelMode(null)} title="Send to Testing">
        <form onSubmit={handlePromote} className="space-y-4">
          <Field label="Batch #"><input className={ic + ' bg-gray-50'} value={promoteForm.batch_number || ''} readOnly /></Field>
          <Field label="SKU"><input className={ic + ' bg-gray-50'} value={promoteForm.sku || ''} readOnly /></Field>
          <Field label="Compound & MG"><input className={ic + ' bg-gray-50'} value={promoteForm.compound_mg || ''} readOnly /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vials Sent" required><input type="number" min="1" className={ic} value={promoteForm.vials_sent || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, vials_sent: e.target.value }))} required /></Field>
            <Field label="Date Sent" required><input type="date" className={ic} value={promoteForm.date_sent || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, date_sent: e.target.value }))} required /></Field>
          </div>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={promoteForm.notes || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Send to Testing'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog isOpen={!!confirmRow} message={`Delete received entry for batch "${confirmRow?.batch_number}"?`} onConfirm={handleDelete} onCancel={() => setConfirmRow(null)} />
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
function Field({ label, required, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
