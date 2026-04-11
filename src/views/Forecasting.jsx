import { useState, useMemo } from 'react'
import { useForecasting } from '../hooks/useForecasting.js'
import Table from '../components/Table.jsx'
import SlidePanel from '../components/SlidePanel.jsx'
import DashboardCard from '../components/DashboardCard.jsx'
import BurnRateChart from '../components/BurnRateChart.jsx'
import WeeklyTrendChart from '../components/WeeklyTrendChart.jsx'

function StatusBadge({ status }) {
  const styles = {
    ok: 'bg-green-100 text-green-800',
    order_soon: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
    overdue: 'bg-red-700 text-white',
  }
  const labels = { ok: 'OK', order_soon: 'Order Soon', low: 'Low Stock', overdue: 'OVERDUE' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  )
}

function TrendArrow({ trendDir, trendPct }) {
  if (trendDir === 'up') return <span className="text-green-600 font-semibold text-xs">▲ +{trendPct}%</span>
  if (trendDir === 'down') return <span className="text-red-500 font-semibold text-xs">▼ {trendPct}%</span>
  return <span className="text-gray-400 text-xs">— steady</span>
}

function FlagCard({ flag, onClick }) {
  const colors = {
    critical: 'border-red-300 bg-red-50',
    warning: 'border-yellow-300 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  }
  const icons = { surge: '🔥', climb: '📈', danger_accel: '⚠️', overdue: '🚨', low: '⚡', new: '🆕', cooling: '❄️' }
  return (
    <button onClick={onClick} className={`text-left w-full border rounded-lg p-3 ${colors[flag.severity] || 'border-gray-200 bg-white'} hover:brightness-95 transition-colors`}>
      <div className="flex items-start gap-2">
        <span className="text-base">{icons[flag.type] || '📌'}</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">{flag.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">{flag.detail}</p>
        </div>
      </div>
    </button>
  )
}

export default function Forecasting({ user }) {
  const { forecast, flags, leadTimes, syncMeta, loading, syncing, syncProgress, error, syncNow, addLeadTime, updateLeadTime, deleteLeadTime } = useForecasting()
  const [selectedItem, setSelectedItem] = useState(null)
  const [showAllFlags, setShowAllFlags] = useState(false)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showLeadTimes, setShowLeadTimes] = useState(false)
  const [ltForm, setLtForm] = useState(null) // null = closed, {} = adding, {id: ...} = editing
  const [ltSaving, setLtSaving] = useState(false)
  const [ltError, setLtError] = useState(null)

  const visibleFlags = showAllFlags ? flags : flags.slice(0, 5)

  const columns = [
    { key: 'sku', label: 'SKU', sticky: true },
    { key: 'product_name', label: 'Product', bold: true },
    { key: 'currentStock', label: 'Stock' },
    { key: 'burn_7d', label: '7d Rate', render: (v) => v > 0 ? `${Number(v).toFixed(1)}/d` : '—' },
    { key: 'burn_30d', label: '30d Rate', render: (v) => v > 0 ? `${Number(v).toFixed(1)}/d` : '—' },
    { key: 'daysRemaining', label: 'Days Left', render: (v) => v >= 9999 ? '999+' : v },
    { key: 'trendDir', label: 'Trend', render: (_, row) => <TrendArrow trendDir={row.trendDir} trendPct={row.trendPct} /> },
    { key: 'reorderQty', label: 'Reorder Qty', render: (v) => v > 0 ? v : '—' },
    { key: 'status', label: 'Status', render: (_, row) => <StatusBadge status={row.status} /> },
  ]

  const filtered = useMemo(() => {
    return forecast.filter((row) => {
      const s = filter.toLowerCase()
      if (s && !row.sku?.toLowerCase().includes(s) && !row.product_name?.toLowerCase().includes(s)) return false
      if (statusFilter === 'alerts' && row.status === 'ok') return false
      if (statusFilter === 'new' && !row.isNew) return false
      return true
    })
  }, [forecast, filter, statusFilter])

  // Summary stats
  const totalProducts = forecast.length
  const alertCount = forecast.filter((f) => f.status === 'low' || f.status === 'overdue').length
  const orderSoonCount = forecast.filter((f) => f.status === 'order_soon').length
  const avgBurn = forecast.length > 0 ? (forecast.reduce((s, f) => s + Number(f.burn_30d || 0), 0) / forecast.length).toFixed(1) : '0'
  const lastSync = syncMeta.woo_sync_last_date ? new Date(syncMeta.woo_sync_last_date).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'

  async function handleLtSave(e) {
    e.preventDefault()
    setLtSaving(true)
    setLtError(null)
    try {
      const payload = { vendor_name: ltForm.vendor_name, sku: ltForm.sku || null, lead_time_days: Number(ltForm.lead_time_days), is_domestic: ltForm.is_domestic || false, notes: ltForm.notes || null }
      if (ltForm.id) await updateLeadTime(ltForm.id, payload, user)
      else await addLeadTime(payload, user)
      setLtForm(null)
    } catch (err) { setLtError(err.message) } finally { setLtSaving(false) }
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Forecasting</h2>
          <p className="text-xs text-gray-400 mt-0.5">Last sync: {lastSync}</p>
        </div>
        <div className="flex gap-2 items-center">
          {syncing && <span className="text-xs text-indigo-600">{syncProgress}</span>}
          <button
            onClick={() => syncNow('incremental')}
            disabled={syncing}
            className="text-sm px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 shadow-sm disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {!syncMeta.woo_sync_last_date && (
            <button
              onClick={() => syncNow('initial')}
              disabled={syncing}
              className="text-sm px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-sm disabled:opacity-50"
            >
              {syncing ? 'Loading...' : 'Load History'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard label="PRODUCTS TRACKED" value={totalProducts} color="border-indigo-400" />
        <DashboardCard label="REORDER ALERTS" value={alertCount} color="border-red-400" sub={`${orderSoonCount} order soon`} />
        <DashboardCard label="AVG BURN RATE" value={`${avgBurn}/d`} color="border-blue-400" sub="30-day average" />
        <DashboardCard label="NEW PRODUCTS" value={forecast.filter(f => f.isNew).length} color="border-green-400" sub="last 60 days" />
      </div>

      {/* Smart Flags */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Smart Flags ({flags.length})</h3>
            {flags.length > 5 && (
              <button onClick={() => setShowAllFlags(!showAllFlags)} className="text-xs text-indigo-600 hover:underline">
                {showAllFlags ? 'Show less' : `Show all ${flags.length}`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleFlags.map((flag, i) => (
              <FlagCard key={i} flag={flag} onClick={() => {
                const item = forecast.find((f) => f.sku === flag.sku)
                if (item) setSelectedItem(item)
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search SKU or product..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Products</option>
          <option value="alerts">Alerts Only</option>
          <option value="new">New Products</option>
        </select>
        <button onClick={() => setShowLeadTimes(!showLeadTimes)} className="text-sm px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
          {showLeadTimes ? 'Hide' : 'Vendor'} Lead Times
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading forecast data...</div>
      ) : forecast.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No sales data yet.</p>
          <p className="mt-1 text-xs">Click "Load History" above to sync your WooCommerce orders.</p>
        </div>
      ) : (
        <Table
          columns={columns}
          rows={filtered}
          onEdit={(row) => setSelectedItem(row)}
          emptyMessage="No products match your filters."
        />
      )}

      {/* Detail Panel */}
      <SlidePanel isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.product_name || 'Product Detail'}>
        {selectedItem && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Current Stock</p>
                <p className="text-xl font-bold text-gray-900">{selectedItem.currentStock}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Days Remaining</p>
                <p className="text-xl font-bold text-gray-900">{selectedItem.daysRemaining >= 9999 ? '999+' : selectedItem.daysRemaining}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Trend (7d vs 30d)</p>
                <p className="text-lg"><TrendArrow trendDir={selectedItem.trendDir} trendPct={selectedItem.trendPct} /></p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Week-over-Week</p>
                <p className="text-lg font-semibold">{selectedItem.wowChange > 0 ? '+' : ''}{selectedItem.wowChange}%</p>
              </div>
            </div>

            {selectedItem.daysRemainingAccelerated < selectedItem.daysRemaining && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-800">Acceleration Warning</p>
                <p className="text-xs text-amber-700 mt-1">
                  30-day rate: {selectedItem.daysRemaining} days left. But at the current 7-day pace: <strong>{selectedItem.daysRemainingAccelerated} days</strong>.
                </p>
              </div>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-indigo-800">Reorder Recommendation</p>
              <p className="text-xs text-indigo-700">Quantity: <strong>{selectedItem.reorderQty} units</strong> (to reach 90-day target)</p>
              <p className="text-xs text-indigo-700">Order by: <strong>{selectedItem.reorderByDate}</strong> (lead time: {selectedItem.leadTime} days)</p>
              <p className="text-xs text-indigo-700">Status: <StatusBadge status={selectedItem.status} /></p>
            </div>

            <BurnRateChart item={selectedItem} />
            <WeeklyTrendChart item={selectedItem} />

            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sales Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['7d', selectedItem.sold_7d], ['30d', selectedItem.sold_30d], ['90d', selectedItem.sold_90d]].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg py-2">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-bold">{val} sold</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlidePanel>

      {/* Vendor Lead Times Section */}
      {showLeadTimes && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Vendor Lead Times</h3>
            <button onClick={() => { setLtForm({ vendor_name: '', sku: '', lead_time_days: '', is_domestic: false, notes: '' }); setLtError(null) }} className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              + Add Vendor
            </button>
          </div>
          {leadTimes.length === 0 ? (
            <p className="text-xs text-gray-400">No vendor lead times set yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">Vendor</th><th>SKU Override</th><th>Lead Time</th><th>Domestic</th><th>Notes</th><th></th>
              </tr></thead>
              <tbody>
                {leadTimes.map((lt) => (
                  <tr key={lt.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium">{lt.vendor_name}</td>
                    <td>{lt.sku || '—'}</td>
                    <td>{lt.lead_time_days} days</td>
                    <td>{lt.is_domestic ? 'Yes' : 'No'}</td>
                    <td className="text-xs text-gray-500">{lt.notes || '—'}</td>
                    <td className="text-right">
                      <button onClick={() => { setLtForm({ ...lt }); setLtError(null) }} className="text-xs text-indigo-600 hover:underline mr-2">Edit</button>
                      <button onClick={() => deleteLeadTime(lt.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Lead Time Form */}
          {ltForm && (
            <form onSubmit={handleLtSave} className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Vendor Name *</label>
                  <input className={ic} value={ltForm.vendor_name} onChange={(e) => setLtForm(p => ({ ...p, vendor_name: e.target.value }))} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">SKU Override (optional)</label>
                  <input className={ic} value={ltForm.sku || ''} onChange={(e) => setLtForm(p => ({ ...p, sku: e.target.value }))} placeholder="Leave blank for vendor default" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Lead Time (days) *</label>
                  <input type="number" min="0" className={ic} value={ltForm.lead_time_days} onChange={(e) => setLtForm(p => ({ ...p, lead_time_days: e.target.value }))} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Domestic?</label>
                  <select className={ic} value={ltForm.is_domestic ? 'yes' : 'no'} onChange={(e) => setLtForm(p => ({ ...p, is_domestic: e.target.value === 'yes' }))}>
                    <option value="no">No (International)</option>
                    <option value="yes">Yes (Domestic)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input className={ic} value={ltForm.notes || ''} onChange={(e) => setLtForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {ltError && <p className="text-xs text-red-600">{ltError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setLtForm(null)} className="px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" disabled={ltSaving} className="px-4 py-2 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {ltSaving ? 'Saving...' : ltForm.id ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

const ic = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
