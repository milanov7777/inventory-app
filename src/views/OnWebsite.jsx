import { useState, useMemo } from 'react'
import { useOnWebsite } from '../hooks/useOnWebsite.js'
import { useOrders } from '../hooks/useOrders.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import SlidePanel from '../components/SlidePanel.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatDate, toISODate } from '../utils/formatDate.js'
import { exportCsv } from '../utils/exportCsv.js'

const columns = [
  { key: 'batch_number', label: 'Batch #', sticky: true },
  { key: 'sku', label: 'SKU' },
  { key: 'compound_mg', label: 'Compound & MG', bold: true },
  { key: 'vendor', label: 'Vendor' },
  { key: 'qty_ordered', label: 'Qty Ordered' },
  { key: 'unit_price', label: 'Unit Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'total_value', label: 'Total', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'qty_listed', label: 'Qty Listed' },
  { key: 'date_listed', label: 'Listed', render: (v) => formatDate(v) },
  { key: 'price_listed', label: 'Price Listed', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'logged_by', label: 'By' },
  { key: 'notes', label: 'Notes', truncate: true },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Compound', type: 'text' },
  { key: 'date_listed', label: 'Date Listed', type: 'date-range' },
]

const emptyForm = { batch_number: '', sku: '', compound_mg: '', qty_listed: '', date_listed: toISODate(), price_listed: '', notes: '' }

export default function OnWebsite({ user }) {
  const { onWebsite, loading, error, addOnWebsite, updateOnWebsite, deleteOnWebsite } = useOnWebsite()
  const { orders } = useOrders()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach((o) => { map[o.batch_number] = o })
    return map
  }, [orders])

  const enriched = useMemo(() =>
    onWebsite.map((r) => {
      const o = orderMap[r.batch_number] || {}
      return { ...r, vendor: o.vendor, unit_price: o.unit_price, total_value: o.total_value, qty_ordered: o.qty_ordered, logged_by: o.logged_by }
    }),
    [onWebsite, orderMap]
  )

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.date_listed_from && row.date_listed < filters.date_listed_from) return false
      if (filters.date_listed_to && row.date_listed > filters.date_listed_to) return false
      return true
    })
  }, [enriched, filters])

  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }))

  function openAdd() { setForm({ ...emptyForm }); setFormError(null); setPanelMode('add') }
  function openEdit(row) {
    setSelectedRow(row)
    setForm({ batch_number: row.batch_number, sku: row.sku, compound_mg: row.compound_mg, qty_listed: row.qty_listed, date_listed: row.date_listed, price_listed: row.price_listed, notes: row.notes || '' })
    setFormError(null); setPanelMode('edit')
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const payload = { ...form, qty_listed: Number(form.qty_listed), price_listed: Number(form.price_listed) }
      if (panelMode === 'add') await addOnWebsite(payload, user)
      else await updateOnWebsite(selectedRow.id, payload, user, selectedRow.batch_number)
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmRow) return
    try { await deleteOnWebsite(confirmRow.id, confirmRow.batch_number, user) }
    catch (err) { console.error(err) } finally { setConfirmRow(null) }
  }

  function handleExport() {
    exportCsv(filtered, columns.map((c) => ({ key: c.key, label: c.label })), 'on-website.csv')
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">On Website</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
          <button onClick={openAdd} className="text-sm px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 shadow-sm">+ Add Listing</button>
        </div>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <Table columns={columns} rows={filtered} onEdit={openEdit} onDelete={(row) => setConfirmRow(row)} emptyMessage="No live listings yet." />
      )}

      <SlidePanel isOpen={panelMode === 'add' || panelMode === 'edit'} onClose={() => setPanelMode(null)} title={panelMode === 'add' ? 'New Listing' : 'Edit Listing'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Batch #" required><input className={ic} value={form.batch_number} onChange={(e) => f('batch_number', e.target.value)} required /></Field>
          <Field label="SKU" required><input className={ic} value={form.sku} onChange={(e) => f('sku', e.target.value)} required /></Field>
          <Field label="Compound & MG" required><input className={ic} value={form.compound_mg} onChange={(e) => f('compound_mg', e.target.value)} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Listed" required><input type="number" min="0" className={ic} value={form.qty_listed} onChange={(e) => f('qty_listed', e.target.value)} required /></Field>
            <Field label="Date Listed" required><input type="date" className={ic} value={form.date_listed} onChange={(e) => f('date_listed', e.target.value)} required /></Field>
          </div>
          <Field label="Price Listed ($)" required><input type="number" min="0" step="0.01" className={ic} value={form.price_listed} onChange={(e) => f('price_listed', e.target.value)} required /></Field>
          <Field label="Notes"><textarea className={ic} rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} /></Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-lime-600 rounded-lg hover:bg-lime-700 disabled:opacity-50">{saving ? 'Saving…' : panelMode === 'add' ? 'Add Listing' : 'Save Changes'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog isOpen={!!confirmRow} message={`Remove listing for batch "${confirmRow?.batch_number}" from On Website?`} onConfirm={handleDelete} onCancel={() => setConfirmRow(null)} />
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
function Field({ label, required, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
