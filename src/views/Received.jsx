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
import { canAdd, canEdit, canDelete, canPromote } from '../utils/permissions.js'

const filterFields = [
  { key: 'search', label: 'Search SKU / Compound', type: 'text' },
  { key: 'storage', label: 'Storage', type: 'select', options: ['fridge', 'shelf', 'box'] },
  { key: 'date_received', label: 'Date Received', type: 'date-range' },
]

const emptyForm = { sku: '', compound_mg: '', qty_received: '', date_received: toISODate(), storage: 'shelf', cap_color: '', notes: '' }

export default function Received({ user, session }) {
  const { received, loading, error, addReceived, updateReceived, deleteReceived } = useReceived()
  const { testing } = useTesting()
  const { orders, refetch } = useOrders()
  const [filters, setFilters] = useState({})
  const [panelMode, setPanelMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [promoteForm, setPromoteForm] = useState({})
  const [splitMode, setSplitMode] = useState('single') // 'single' | 'split'
  const [splitRows, setSplitRows] = useState([{ batch_number: '', vials_sent: '' }])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach((o) => { map[o.id] = o })
    return map
  }, [orders])

  // Enrich rows with order info (vendor, total_value, etc.)
  const enriched = useMemo(() =>
    received.map((r) => {
      const o = orderMap[r.order_id] || {}
      const remaining = r.qty_remaining ?? r.qty_received ?? 0
      return {
        ...r,
        _orderStatus: o.status || 'received',
        vendor: o.vendor,
        unit_price: o.unit_price,
        total_value: o.total_value,
        qty_ordered: o.qty_ordered,
        _qty_remaining: remaining,
      }
    }),
    [received, orderMap]
  )

  // Show received rows that still have qty available to test (qty_remaining > 0)
  // OR grandfathered rows where order status is still 'received'.
  // Sorted by date_received (newest first).
  const filtered = useMemo(() => {
    const rows = enriched.filter((row) => {
      const hasRemaining = (row.qty_remaining ?? row.qty_received ?? 0) > 0
      const stillReceivedStatus = row._orderStatus === 'received'
      if (!hasRemaining && !stillReceivedStatus) return false
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.compound_mg?.toLowerCase().includes(s)) return false
      if (filters.storage && row.storage !== filters.storage) return false
      if (filters.date_received_from && row.date_received < filters.date_received_from) return false
      if (filters.date_received_to && row.date_received > filters.date_received_to) return false
      return true
    })
    rows.sort((a, b) => (a.date_received || '').localeCompare(b.date_received || ''))
    return rows
  }, [enriched, filters])

  const columns = [
    { key: 'sku', label: 'SKU', sticky: true },
    { key: 'compound_mg', label: 'Compound & MG', bold: true },
    { key: 'vendor', label: 'Vendor' },
    { key: 'qty_ordered', label: 'Qty Ordered' },
    { key: 'qty_received', label: 'Qty Received' },
    { key: '_qty_remaining', label: 'Available to Test', render: (v, row) => (
      <span className={`font-semibold ${v > 0 ? 'text-green-700' : 'text-gray-400'}`}>
        {v} / {row.qty_received}
      </span>
    ) },
    { key: 'date_received', label: 'Received', render: (v) => formatDate(v) },
    { key: 'storage', label: 'Storage', render: (v) => v ? (
      <span className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${v === 'fridge' ? 'bg-blue-500' : v === 'box' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
        {v.charAt(0).toUpperCase() + v.slice(1)}
      </span>
    ) : '—' },
    { key: 'cap_color', label: 'Cap Color' },
    { key: 'logged_by', label: 'By' },
    { key: 'notes', label: 'Notes', truncate: true },
  ]

  function openAdd() { setForm({ ...emptyForm }); setFormError(null); setPanelMode('add') }
  function openEdit(row) {
    setSelectedRow(row)
    setForm({ sku: row.sku, compound_mg: row.compound_mg, qty_received: row.qty_received, date_received: row.date_received, storage: row.storage, cap_color: row.cap_color || '', notes: row.notes || '' })
    setFormError(null); setPanelMode('edit')
  }
  function openPromote(row) {
    setSelectedRow(row)
    const remaining = row.qty_remaining ?? row.qty_received
    setPromoteForm({
      received_id: row.id,
      sku: row.sku,
      compound_mg: row.compound_mg,
      available: remaining,
      batch_number: '',
      vials_sent: remaining,
      date_sent: toISODate(),
      lab: '',
      notes: '',
    })
    setSplitMode('single')
    setSplitRows([{ batch_number: '', vials_sent: '' }])
    setFormError(null); setPanelMode('promote')
  }

  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }))

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const qty = Number(form.qty_received)
      const payload = { ...form, qty_received: qty, qty_remaining: panelMode === 'add' ? qty : undefined, logged_by: user }
      if (panelMode === 'add') await addReceived(payload, user)
      else {
        // Don't overwrite qty_remaining on edit unless user explicitly changed qty_received
        const editPayload = { ...payload }
        if (editPayload.qty_remaining === undefined) delete editPayload.qty_remaining
        await updateReceived(selectedRow.id, editPayload, user, selectedRow.batch_number)
      }
      setPanelMode(null)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  async function handlePromote(e) {
    e.preventDefault(); setSaving(true); setFormError(null)
    try {
      const available = promoteForm.available
      let batches = []
      let totalSent = 0

      if (splitMode === 'single') {
        const batch = promoteForm.batch_number?.trim()
        const qty = Number(promoteForm.vials_sent)
        if (!batch) throw new Error('Please enter a batch number.')
        if (!qty || qty < 1) throw new Error('Vials sent must be at least 1.')
        if (qty > available) throw new Error(`Vials sent (${qty}) exceeds available (${available}).`)
        if (!promoteForm.lab) throw new Error('Please pick a lab.')
        batches = [{ batch_number: batch, vials_sent: qty }]
        totalSent = qty
      } else {
        for (const row of splitRows) {
          const batch = row.batch_number?.trim()
          const qty = Number(row.vials_sent)
          if (!batch || !qty) continue
          if (qty < 1) throw new Error('Each batch must have qty ≥ 1.')
          batches.push({ batch_number: batch, vials_sent: qty })
          totalSent += qty
        }
        if (batches.length < 1) throw new Error('Add at least 1 batch.')
        if (totalSent > available) throw new Error(`Total (${totalSent}) exceeds available (${available}).`)
        if (!promoteForm.lab) throw new Error('Please pick a lab.')
      }

      // Insert each batch as a testing row
      const testingRows = batches.map((b) => ({
        received_id: promoteForm.received_id,
        batch_number: b.batch_number,
        sku: promoteForm.sku,
        compound_mg: promoteForm.compound_mg,
        lab: promoteForm.lab,
        vials_sent: b.vials_sent,
        date_sent: promoteForm.date_sent,
        coa_on_file: 'no',
        logged_by: user,
        notes: promoteForm.notes || null,
      }))
      const { error: insertErr } = await supabase.from('testing').insert(testingRows)
      if (insertErr) throw new Error(insertErr.message)

      // Decrement qty_remaining on the received row
      const newRemaining = available - totalSent
      const { error: updErr } = await supabase
        .from('received')
        .update({ qty_remaining: newRemaining })
        .eq('id', promoteForm.received_id)
      if (updErr) throw new Error(updErr.message)

      // If the received row links to an order, update the order status to 'in_testing'
      if (selectedRow?.order_id) {
        await supabase.from('orders').update({ status: 'in_testing' }).eq('id', selectedRow.order_id)
      }

      // Audit + Slack for each batch
      for (const b of batches) {
        await logAction({ userName: user, actionType: 'promote', batchNumber: b.batch_number, stage: 'testing', changes: { from: 'received', to: 'testing', received_id: promoteForm.received_id, vials_sent: b.vials_sent, lab: promoteForm.lab } })
        notifySlack('sent_to_testing', { batch_number: b.batch_number, user })
      }

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
    exportCsv(filtered, columns.map((c) => ({ key: c.key, label: c.label })), 'received.csv')
  }

  function updateSplitRow(idx, key, value) {
    setSplitRows((rows) => rows.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }
  function addSplitRow() {
    setSplitRows((rows) => [...rows, { batch_number: '', vials_sent: '' }])
  }
  function removeSplitRow(idx) {
    setSplitRows((rows) => rows.filter((_, i) => i !== idx))
  }
  const splitTotal = splitRows.reduce((sum, r) => sum + (Number(r.vials_sent) || 0), 0)

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  // Disable Send to Testing when nothing's left
  const canSendRow = (row) => (row.qty_remaining ?? row.qty_received ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Received</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
          {canAdd(session) && <button onClick={openAdd} className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm">+ Add Received</button>}
        </div>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? <div className="flex flex-col items-center justify-center py-12 gap-3"><svg className="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="text-sm text-gray-400">Loading...</span></div> : (
        <Table columns={columns} rows={filtered} onEdit={canEdit(session) ? openEdit : undefined} onDelete={canDelete(session) ? (row) => setConfirmRow(row) : undefined}
          onPromote={canPromote(session) ? openPromote : undefined} promoteLabel="Send to Testing" promotedLabel="All sent ✓"
          canPromote={canSendRow}
          emptyMessage="No received items yet." />
      )}

      {/* Add / Edit Panel */}
      <SlidePanel isOpen={panelMode === 'add' || panelMode === 'edit'} onClose={() => setPanelMode(null)} title={panelMode === 'add' ? 'New Received Entry' : 'Edit Received Entry'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            No batch # here — that gets assigned when you Send to Testing.
          </div>
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
                <option value="box">Box</option>
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

      {/* Send to Testing Panel — single OR split */}
      <SlidePanel isOpen={panelMode === 'promote'} onClose={() => setPanelMode(null)} title="Send to Testing">
        <form onSubmit={handlePromote} className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-1">
            <div><span className="text-gray-400">SKU:</span> <b>{promoteForm.sku}</b></div>
            <div><span className="text-gray-400">Compound:</span> <b>{promoteForm.compound_mg}</b></div>
            <div><span className="text-gray-400">Available to send:</span> <b>{promoteForm.available}</b></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">How do you want to batch this?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSplitMode('single')}
                className={`text-xs px-3 py-3 rounded-lg border-2 font-medium ${splitMode === 'single' ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                📦 One batch<br/><span className="text-[10px] font-normal">All at once, one batch #</span>
              </button>
              <button type="button" onClick={() => setSplitMode('split')}
                className={`text-xs px-3 py-3 rounded-lg border-2 font-medium ${splitMode === 'split' ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                ✂️ Split into batches<br/><span className="text-[10px] font-normal">Multiple batch #s</span>
              </button>
            </div>
          </div>

          {splitMode === 'single' ? (
            <>
              <Field label="Batch #" required>
                <input className={ic} value={promoteForm.batch_number || ''}
                  onChange={(e) => setPromoteForm((p) => ({ ...p, batch_number: e.target.value }))}
                  placeholder="e.g. NV-P-1234" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Vials Sent" required>
                  <input type="number" min="1" max={promoteForm.available} className={ic} value={promoteForm.vials_sent || ''}
                    onChange={(e) => setPromoteForm((p) => ({ ...p, vials_sent: e.target.value }))} required />
                </Field>
                <Field label="Date Sent" required>
                  <input type="date" className={ic} value={promoteForm.date_sent || ''}
                    onChange={(e) => setPromoteForm((p) => ({ ...p, date_sent: e.target.value }))} required />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900">
                Add one row per batch. Quantities don't have to add up to the available total — anything you leave behind stays on the Received tab.
              </div>
              <div className="space-y-2">
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5"
                      placeholder="Batch # (e.g. NV-P-1234A)"
                      value={row.batch_number}
                      onChange={(e) => updateSplitRow(idx, 'batch_number', e.target.value)} />
                    <input type="number" min="1" max={promoteForm.available}
                      className="w-24 text-sm border border-gray-200 rounded px-2 py-1.5"
                      placeholder="Vials"
                      value={row.vials_sent}
                      onChange={(e) => updateSplitRow(idx, 'vials_sent', e.target.value)} />
                    {splitRows.length > 2 && (
                      <button type="button" onClick={() => removeSplitRow(idx)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addSplitRow} className="text-xs text-orange-600 hover:text-orange-800 font-medium">+ Add another batch</button>
              <div className="text-xs flex justify-between border-t pt-2">
                <span>Total assigned: <b className={splitTotal <= promoteForm.available ? 'text-gray-800' : 'text-red-600'}>{splitTotal}</b></span>
                <span>Available: <b>{promoteForm.available}</b></span>
              </div>
              <Field label="Date Sent" required>
                <input type="date" className={ic} value={promoteForm.date_sent || ''}
                  onChange={(e) => setPromoteForm((p) => ({ ...p, date_sent: e.target.value }))} required />
              </Field>
            </>
          )}

          <Field label="Lab" required>
            <select className={ic} value={promoteForm.lab || ''}
              onChange={(e) => setPromoteForm((p) => ({ ...p, lab: e.target.value }))} required>
              <option value="">Select lab...</option>
              <option value="Freedom">Freedom</option>
              <option value="Vanguard">Vanguard</option>
              <option value="Ethos">Ethos</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Logged By"><input className={ic + ' bg-gray-50'} value={user} readOnly /></Field>
          <Field label="Notes"><textarea className={ic} rows={2} value={promoteForm.notes || ''}
            onChange={(e) => setPromoteForm((p) => ({ ...p, notes: e.target.value }))} /></Field>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPanelMode(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Send to Testing'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog isOpen={!!confirmRow} message={`Delete received entry for ${confirmRow?.sku}?`} onConfirm={handleDelete} onCancel={() => setConfirmRow(null)} />
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500'
function Field({ label, required, children }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
