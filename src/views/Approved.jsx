import { useState, useMemo } from 'react'
import { useApproved } from '../hooks/useApproved.js'
import { useOnWebsite } from '../hooks/useOnWebsite.js'
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
import { canAdd, canEdit, canDelete, canPromote } from '../utils/permissions.js'

const columns = [
  { key: 'batch_number', label: 'Batch #', sticky: true },
  { key: 'sku', label: 'SKU' },
  { key: 'compound_mg', label: 'Compound & MG', bold: true },
  { key: 'vendor', label: 'Vendor' },
  { key: 'qty_ordered', label: 'Qty Ordered' },
  { key: 'unit_price', label: 'Unit Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'total_value', label: 'Total', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'qty_available', label: 'Qty Available' },
  { key: 'approved_date', label: 'Approved', render: (v) => formatDate(v) },
  { key: 'storage', label: 'Storage', render: (v) => v ? (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${v === 'fridge' ? 'bg-blue-500' : 'bg-gray-400'}`} />
      {v.charAt(0).toUpperCase() + v.slice(1)}
    </span>
  ) : '—' },
  { key: 'logged_by', label: 'By' },
  { key: 'status', label: 'Status', render: (_, row) => <Badge status={row._orderStatus} /> },
  { key: 'notes', label: 'Notes', truncate: true },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Compound', type: 'text' },
  { key: 'storage', label: 'Storage', type: 'select', options: ['fridge', 'shelf'] },
  { key: 'approved_date', label: 'Approved Date', type: 'date-range' },
]

const emptyForm = { batch_number: '', sku: '', compound_mg: '', qty_available: '', approved_date: toISODate(), storage: 'shelf', notes: '' }

export default function Approved({ user, session }) {
  const { approved, loading, error, addApproved, updateApproved, deleteApproved } = useApproved()
  const { onWebsite } = useOnWebsite()
  const { orders, refetch } = useOrders()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [promoteForm, setPromoteForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const websiteBatches = useMemo(() => new Set(onWebsite.map((r) => r.batch_number)), [onWebsite])
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
    approved.map((r) => {
      const o = orderMap[r.batch_number] || {}
      return { ...r, _orderStatus: orderStatusMap[r.batch_number] || 'approved', vendor: o.vendor, unit_price: o.unit_price, total_value: o.total_value, qty_ordered: o.qty_ordered }
    }),
    [approved, orderMap, orderStatusMap]
  )

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      // Only show items currently at approved stage — not already on website
      const status = orderStatusMap[row.batch_number]
      if (status && status !== 'approved') return false
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.storage && row.storage !== filters.storage) return false
      if (filters.approved_date_from && row.approved_date < filters.approved_date_from) return false
      if (filters.approved_date_to && row.approved_date > filters.approved_date_to) return false
      return true
    })
  }, [enriched, filters, orderStatusMap])

  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }))

  function openAdd() { setForm({ ...emptyForm }); setFormError(null); setPanelMode('add') }
  function openEdit(row) {
    setSelectedRow(row)
    setForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, qty_available: row.qty_available, approved_date: row.approved_date, storage: row.storage, notes: row.notes || '' })
    setFormError(null); setPanelMode('edit')
  }
  function openPromote(row) {
    setSelectedRow(row)
    setPromoteForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, qty_listed: row.qty_available, date_listed: toISODate(), price_listed: '', notes: '' })
    setFormError(null); setPanelMode('promote')
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...form, qty_available: Number(form.qty_available), logged_by: user }
      if (panelMode === 'add') await addApproved(payload, user)
      else await updateApproved(selectedRow.id, payload, user, selectedRow.batch_number)
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handlePromote(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...promoteForm, qty_listed: Number(promoteForm.qty_listed), price_listed: Number(promoteForm.price_listed) }
      const { error: insertErr } = await supabase.from('on_website').insert(payload)
      if (insertErr) throw new Error(insertErr.message)
      const { error: statusErr } = await supabase.from('orders').update({ status: 'live' }).eq('batch_number', promoteForm.batch_number)
      if (statusErr) throw new Error(statusErr.message)
      await logAction({ userName: user, actionType: 'promote', batchNumber: promoteForm.batch_number, stage: 'on_website', changes: { from: 'approved', to: 'on_website', ...payload } })
      notifySlack('listed_on_website', { batch_number: promoteForm.batch_number, user })
      await refetch()
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmRow) return
    try { await deleteApproved(confirmRow.id, confirmRow.batch_number, user) }
    catch (err) { console.error(err) } finally { setConfirmRow(null) }
  }

  function handleExport() {
    exportCsv(filtered, columns.filter((c) => c.key !== 'status').map((c) => ({ key: c.key, label: c.label })), 'approved.csv')
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Approved & Ready</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
          {canAdd(session) && <button onClick={openAdd} className="text-sm px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 shadow-sm">+ Add Approved</button>}
        </div>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <Table columns={columns} rows={filtered} onEdit={canEdit(session) ? openEdit : undefined} onDelete={canDelete(session) ? (row) => setConfirmRow(row) : undefined}
          onPromote={canPromote(session) ? openPromote : undefined} promoteLabel="List on Website" promotedLabel="Listed ✓"
          canPromote={(row) => !websiteBatches.has(row.batch_number)}
          emptyMessage="No approved batches yet." />
      )}

      <SlidePanel isOpen={panelMode === 'add' || panelMode === 'edit'} onClose={() => setPanelMode(null)} title={panelMode === 'add' ? 'New Approved Entry' : 'Edit Approved Entry'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Batch #" required><input className={ic} value={form.batch_number} onChange={(e) => f('batch_number', e.target.value)} required /></Field>
          <Field label="SKU" required><input className={ic} value={form.sku} onChange={(e) => f('sku', e.target.value)} required /></Field>
          <Field label="Compound & MG" required><input className={ic} value={form.compound_mg} onChange={(e) => f('compound_mg', e.target.value)} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Available" required><input type="number" min="0" className={ic} value={form.qty_available} onChange={(e) => f('qty_available', e.target.value)} required /></Field>
            <Field label="Approved Date" required><input type="date" className={ic} value={form.approved_date} onChange={(e) => f('approved_date', e.target.value)} required /></Field>
          </div>
          <Field label="Storage" required>
            <select className={ic} value={form.storage} onChange={(e) => f('storage', e.target.value)}>
              <option value="shelf">Shelf</option>
              <option value="fridge">Fridge</option>
            </select>
          </Field>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving…' : panelMode === 'add' ? 'Add Entry' : 'Save Changes'}</button>
          </div>
        </form>
      </SlidePanel>

      <SlidePanel isOpen={panelMode === 'promote'} onClose={() => setPanelMode(null)} title="List on Website">
        <form onSubmit={handlePromote} className="space-y-4">
          <Field label="Batch #"><input className={ic + ' bg-gray-50'} value={promoteForm.batch_number || ''} readOnly /></Field>
          <Field label="SKU"><input className={ic + ' bg-gray-50'} value={promoteForm.sku || ''} readOnly /></Field>
          <Field label="Compound & MG"><input className={ic + ' bg-gray-50'} value={promoteForm.compound_mg || ''} readOnly /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Listed" required><input type="number" min="0" className={ic} value={promoteForm.qty_listed || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, qty_listed: e.target.value }))} required /></Field>
            <Field label="Date Listed" required><input type="date" className={ic} value={promoteForm.date_listed || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, date_listed: e.target.value }))} required /></Field>
          </div>
          <Field label="Price Listed ($)" required><input type="number" min="0" step="0.01" className={ic} value={promoteForm.price_listed || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, price_listed: e.target.value }))} required /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={promoteForm.notes || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-lime-600 rounded-lg hover:bg-lime-700 disabled:opacity-50">{saving ? 'Saving…' : 'List on Website'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog isOpen={!!confirmRow} message={`Delete approved entry for batch "${confirmRow?.batch_number}"?`} onConfirm={handleDelete} onCancel={() => setConfirmRow(null)} />
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, required, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
