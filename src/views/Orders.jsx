import { useState, useMemo } from 'react'
import { useOrders } from '../hooks/useOrders.js'
import { useReceived } from '../hooks/useReceived.js'
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

const columns = [
  { key: 'batch_number', label: 'Batch #', sticky: true },
  { key: 'sku', label: 'SKU' },
  { key: 'compound_mg', label: 'Compound & MG', bold: true },
  { key: 'vendor', label: 'Vendor' },
  { key: 'qty_ordered', label: 'Qty' },
  { key: 'unit_price', label: 'Unit Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'total_value', label: 'Total', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'date_ordered', label: 'Ordered', render: (v) => formatDate(v) },
  { key: 'tracking_number', label: 'Tracking', truncate: true },
  { key: 'logged_by', label: 'By' },
  { key: 'notes', label: 'Notes', truncate: true },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Compound', type: 'text' },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'date_ordered', label: 'Date Ordered', type: 'date-range' },
]

const emptyForm = {
  sku: '', compound_mg: '', qty_ordered: '', batch_number: '',
  vendor: '', unit_price: '', date_ordered: toISODate(),
  tracking_number: '', shipping_cost: '0', notes: '',
}

export default function Orders({ user }) {
  const { orders, loading, error, addOrder, updateOrder, deleteOrder, refetch } = useOrders()
  const { received } = useReceived()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null) // 'add' | 'edit' | 'promote'
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [promoteForm, setPromoteForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Batches already in received
  const receivedBatches = useMemo(() => new Set(received.map((r) => r.batch_number)), [received])

  // Color palette for vendor+date groups
  const groupColors = [
    'bg-amber-50 border-l-[3px] border-amber-400',
    'bg-blue-50 border-l-[3px] border-blue-400',
    'bg-purple-50 border-l-[3px] border-purple-400',
    'bg-green-50 border-l-[3px] border-green-400',
    'bg-rose-50 border-l-[3px] border-rose-400',
    'bg-cyan-50 border-l-[3px] border-cyan-400',
    'bg-orange-50 border-l-[3px] border-orange-400',
  ]

  const filtered = useMemo(() => {
    const rows = orders.filter((row) => {
      // Only show orders with status 'ordered'
      if (row.status !== 'ordered') return false
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.vendor && !row.vendor?.toLowerCase().includes(filters.vendor.toLowerCase())) return false
      if (filters.date_ordered_from && row.date_ordered < filters.date_ordered_from) return false
      if (filters.date_ordered_to && row.date_ordered > filters.date_ordered_to) return false
      return true
    })
    // Sort by date (newest first), then vendor
    rows.sort((a, b) => {
      if ((b.date_ordered || '') !== (a.date_ordered || '')) return (b.date_ordered || '').localeCompare(a.date_ordered || '')
      return (a.vendor || '').localeCompare(b.vendor || '')
    })
    return rows
  }, [orders, filters])

  // Build a map: vendor+date → color class
  const groupColorMap = useMemo(() => {
    const map = {}
    let colorIdx = 0
    filtered.forEach((row) => {
      const key = `${row.vendor || 'Unknown'}|${row.date_ordered || 'no-date'}`
      if (!(key in map)) {
        map[key] = groupColors[colorIdx % groupColors.length]
        colorIdx++
      }
    })
    return map
  }, [filtered])

  function openAdd() {
    setForm({ ...emptyForm, date_ordered: toISODate() })
    setFormError(null)
    setPanelMode('add')
  }

  function openEdit(row) {
    setSelectedRow(row)
    setForm({
      sku: row.sku, compound_mg: row.compound_mg, qty_ordered: row.qty_ordered,
      batch_number: row.batch_number, vendor: row.vendor, unit_price: row.unit_price,
      date_ordered: row.date_ordered, tracking_number: row.tracking_number || '',
      shipping_cost: row.shipping_cost || '0', notes: row.notes || '',
    })
    setFormError(null)
    setPanelMode('edit')
  }

  function openPromote(row) {
    setSelectedRow(row)
    setPromoteForm({
      batch_number: row.batch_number,
      sku: row.sku,
      compound_mg: row.compound_mg,
      qty_received: '',
      date_received: toISODate(),
      storage: 'shelf',
      cap_color: '',
      notes: '',
    })
    setFormError(null)
    setPanelMode('promote')
  }

  function f(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        qty_ordered: Number(form.qty_ordered),
        unit_price: Number(form.unit_price),
        shipping_cost: Number(form.shipping_cost),
        logged_by: user,
      }
      if (panelMode === 'add') {
        await addOrder(payload, user)
      } else {
        await updateOrder(selectedRow.id, payload, user, selectedRow.batch_number)
      }
      setPanelMode(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePromote(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...promoteForm,
        qty_received: Number(promoteForm.qty_received),
        logged_by: user,
      }
      const { error: insertErr } = await supabase.from('received').insert(payload)
      if (insertErr) throw new Error(insertErr.message)
      const { error: statusErr } = await supabase
        .from('orders')
        .update({ status: 'received' })
        .eq('batch_number', promoteForm.batch_number)
      if (statusErr) throw new Error(statusErr.message)
      await logAction({ userName: user, actionType: 'promote', batchNumber: promoteForm.batch_number, stage: 'received', changes: { from: 'orders', to: 'received', ...payload } })
      notifySlack('order_received', { batch_number: promoteForm.batch_number, user })
      await refetch()
      setPanelMode(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmRow) return
    try {
      await deleteOrder(confirmRow.id, confirmRow.batch_number, user)
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmRow(null)
    }
  }

  function handleExport() {
    exportCsv(filtered, columns.map((c) => ({ key: c.key, label: c.label })), 'orders.csv')
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  const canPromoteRow = (row) => !receivedBatches.has(row.batch_number)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Orders</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">Export CSV</button>
          <button onClick={openAdd} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">+ Add Order</button>
        </div>
      </div>

      <SearchFilter fields={filterFields} onFilter={setFilters} />

      {/* Color legend for vendor+date groups */}
      {Object.keys(groupColorMap).length > 0 && (
        <div className="flex flex-wrap gap-3 items-center text-xs text-gray-600">
          <span className="font-medium text-gray-500">Groups:</span>
          {Object.entries(groupColorMap).map(([key, cls]) => {
            const [vendor, date] = key.split('|')
            const borderColor = cls.match(/border-(\w+)-400/)?.[0] || ''
            return (
              <span key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${cls}`}>
                <span className="font-semibold">{vendor}</span>
                <span className="text-gray-400">·</span>
                <span>{date === 'no-date' ? 'No date' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </span>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <Table
          columns={columns}
          rows={filtered}
          onEdit={openEdit}
          onDelete={(row) => setConfirmRow(row)}
          onPromote={openPromote}
          promoteLabel="Mark Received"
          promotedLabel="Received ✓"
          canPromote={canPromoteRow}
          rowClassName={(row) => {
            const key = `${row.vendor || 'Unknown'}|${row.date_ordered || 'no-date'}`
            return groupColorMap[key] || ''
          }}
          emptyMessage="No orders yet. Click '+ Add Order' to get started."
        />
      )}

      {/* Add / Edit Panel */}
      <SlidePanel
        isOpen={panelMode === 'add' || panelMode === 'edit'}
        onClose={() => setPanelMode(null)}
        title={panelMode === 'add' ? 'New Order' : 'Edit Order'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Batch #" required>
            <input className={inputCls} value={form.batch_number} onChange={(e) => f('batch_number', e.target.value)} required />
          </Field>
          <Field label="SKU" required>
            <input className={inputCls} value={form.sku} onChange={(e) => f('sku', e.target.value)} required />
          </Field>
          <Field label="Compound & MG" required>
            <input className={inputCls} value={form.compound_mg} onChange={(e) => f('compound_mg', e.target.value)} required />
          </Field>
          <Field label="Vendor" required>
            <input className={inputCls} value={form.vendor} onChange={(e) => f('vendor', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Ordered" required>
              <input type="number" min="1" className={inputCls} value={form.qty_ordered} onChange={(e) => f('qty_ordered', e.target.value)} required />
            </Field>
            <Field label="Unit Price ($)" required>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.unit_price} onChange={(e) => f('unit_price', e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date Ordered" required>
              <input type="date" className={inputCls} value={form.date_ordered} onChange={(e) => f('date_ordered', e.target.value)} required />
            </Field>
            <Field label="Shipping Cost ($)">
              <input type="number" min="0" step="0.01" className={inputCls} value={form.shipping_cost} onChange={(e) => f('shipping_cost', e.target.value)} />
            </Field>
          </div>
          <Field label="Tracking #">
            <input className={inputCls} value={form.tracking_number} onChange={(e) => f('tracking_number', e.target.value)} />
          </Field>
          <Field label="Logged By">
            <input className={inputCls + ' bg-gray-50'} value={user} readOnly />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} />
          </Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : panelMode === 'add' ? 'Add Order' : 'Save Changes'}
            </button>
          </div>
        </form>
      </SlidePanel>

      {/* Promote Panel */}
      <SlidePanel
        isOpen={panelMode === 'promote'}
        onClose={() => setPanelMode(null)}
        title="Mark as Received"
      >
        <form onSubmit={handlePromote} className="space-y-4">
          <Field label="Batch #">
            <input className={inputCls + ' bg-gray-50'} value={promoteForm.batch_number || ''} readOnly />
          </Field>
          <Field label="SKU">
            <input className={inputCls + ' bg-gray-50'} value={promoteForm.sku || ''} readOnly />
          </Field>
          <Field label="Compound & MG">
            <input className={inputCls + ' bg-gray-50'} value={promoteForm.compound_mg || ''} readOnly />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Qty Received" required>
              <input type="number" min="1" className={inputCls} value={promoteForm.qty_received || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, qty_received: e.target.value }))} required />
            </Field>
            <Field label="Date Received" required>
              <input type="date" className={inputCls} value={promoteForm.date_received || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, date_received: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Storage" required>
            <select className={inputCls} value={promoteForm.storage || 'shelf'} onChange={(e) => setPromoteForm((p) => ({ ...p, storage: e.target.value }))}>
              <option value="shelf">Shelf</option>
              <option value="fridge">Fridge</option>
            </select>
          </Field>
          <Field label="Cap Color">
            <input className={inputCls} value={promoteForm.cap_color || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, cap_color: e.target.value }))} />
          </Field>
          <Field label="Logged By">
            <input className={inputCls + ' bg-gray-50'} value={user} readOnly />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={3} value={promoteForm.notes || ''} onChange={(e) => setPromoteForm((p) => ({ ...p, notes: e.target.value }))} />
          </Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Mark Received'}
            </button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog
        isOpen={!!confirmRow}
        message={`Delete order for batch "${confirmRow?.batch_number}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmRow(null)}
      />
    </div>
  )
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
