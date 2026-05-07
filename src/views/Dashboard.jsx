import { useMemo } from 'react'
import { useDashboard } from '../hooks/useDashboard.js'
import { useOrders } from '../hooks/useOrders.js'
import { useReceived } from '../hooks/useReceived.js'
import { useApproved } from '../hooks/useApproved.js'
import DashboardCard from '../components/DashboardCard.jsx'
import AlertsPanel from '../components/AlertsPanel.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import { detectCarrier } from '../utils/trackingUtils.js'

const fmtMoney = (v) =>
  `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Dashboard({ user, session }) {
  const { stats, lowStock, thresholds, recentActivity, loading, updateThreshold } = useDashboard()
  const { orders } = useOrders()
  const { received } = useReceived()
  const { approved } = useApproved()

  const allSkus = useMemo(() => [...new Set(orders.map((o) => o.sku))].sort(), [orders])

  // Pipeline counts (based on orders.status — matches tab badge logic)
  const pipelineCounts = useMemo(() => {
    const statusCounts = {}
    orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })
    return {
      ordered: statusCounts['ordered'] || 0,
      received: statusCounts['received'] || 0,
      testing: statusCounts['in_testing'] || 0,
      approved: statusCounts['approved'] || 0,
      on_website: statusCounts['live'] || 0,
    }
  }, [orders])

  // SKU inventory summary for alerts panel
  const skuSummary = useMemo(() => {
    const map = {}
    received.forEach((r) => {
      map[r.sku] = (map[r.sku] || 0) + (r.qty_received || 0)
    })
    approved.forEach((a) => {
      map[a.sku] = (map[a.sku] || 0) + (a.qty_available || 0)
    })
    return Object.entries(map)
      .map(([sku, qty]) => ({ sku, total_qty: qty }))
      .sort((a, b) => a.sku.localeCompare(b.sku))
  }, [received, approved])

  // Orders in transit: status = 'ordered' and has a tracking number
  const inTransit = useMemo(() => {
    return orders
      .filter((o) => o.status === 'ordered' && o.tracking_number && o.tracking_number.trim())
      .sort((a, b) => (b.date_ordered || '').localeCompare(a.date_ordered || ''))
  }, [orders])

  if (loading) {
    return <div className="flex flex-col items-center justify-center py-20 gap-3"><svg className="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="text-sm text-gray-400">Loading dashboard...</span></div>
  }

  const pipelineStages = [
    { label: 'Ordered', count: pipelineCounts.ordered, color: 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800' },
    { label: 'Received', count: pipelineCounts.received, color: 'bg-gradient-to-br from-green-100 to-green-200 text-green-800' },
    { label: 'Testing', count: pipelineCounts.testing, color: 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800' },
    { label: 'Approved', count: pipelineCounts.approved, color: 'bg-gradient-to-br from-teal-100 to-teal-200 text-teal-800' },
    { label: 'On Website', count: pipelineCounts.on_website, color: 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>

      {/* Stat Cards — 5 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <DashboardCard
          label="Unique SKUs"
          value={stats.uniqueSkus}
          color="border-brand-500"
          sub="across all stages"
        />
        <DashboardCard
          label="Units On Hand"
          value={stats.totalUnits.toLocaleString()}
          color="border-green-500"
          sub="received + approved"
        />
        <DashboardCard
          label="Inventory Value"
          value={fmtMoney(stats.totalValue)}
          color="border-cyan-500"
          sub="at cost"
        />
        <DashboardCard
          label="In Testing"
          value={pipelineCounts.testing}
          color="border-amber-500"
          sub="batches at labs"
        />
        <DashboardCard
          label="Approved & Ready"
          value={pipelineCounts.approved}
          color="border-teal-500"
          sub="not yet on website"
        />
      </div>

      {/* Pipeline Flow Bar */}
      <div className="glass-strong rounded-xl border border-white/50 shadow-lg shadow-brand-500/5 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Overview</h3>
        <div className="flex items-center gap-1 overflow-x-auto">
          {pipelineStages.map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              <div className={`flex flex-col items-center px-4 py-3 rounded-xl ${stage.color} min-w-[100px] shadow-sm`}>
                <span className="text-2xl font-bold">{stage.count}</span>
                <span className="text-xs font-medium mt-0.5">{stage.label}</span>
              </div>
              {i < pipelineStages.length - 1 && (
                <svg className="w-5 h-5 text-brand-400 shrink-0 mx-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* In Transit */}
      <div className="glass-strong rounded-xl border border-white/50 shadow-lg shadow-brand-500/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Packages in Transit</h3>
          <span className="text-xs text-gray-400">{inTransit.length} shipment{inTransit.length !== 1 ? 's' : ''}</span>
        </div>
        {inTransit.length === 0 ? (
          <p className="text-sm text-gray-400">No packages currently in transit.</p>
        ) : (
          <div className="space-y-2">
            {inTransit.map((o) => {
              const { name: carrier, url, color } = detectCarrier(o.tracking_number)
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{carrier}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{o.sku} — {o.compound_mg}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {o.vendor && <span className="mr-2">{o.vendor}</span>}
                        {o.date_ordered && <span>Ordered {new Date(o.date_ordered + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-gray-500 hidden sm:block">{o.tracking_number}</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
                      >
                        Track →
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">{o.tracking_number}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Alerts + Activity + SKU Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <AlertsPanel
            lowStockItems={lowStock}
            thresholds={thresholds}
            onUpdateThreshold={updateThreshold}
            user={user}
            allSkus={allSkus}
            session={session}
          />

          {/* SKU Inventory Summary */}
          <div className="glass-strong rounded-xl border border-white/50 shadow-lg shadow-brand-500/5 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">SKU Inventory Summary</h3>
            {skuSummary.length === 0 ? (
              <p className="text-sm text-gray-400">No inventory data yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="min-w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {skuSummary.map((item) => (
                      <tr key={item.sku}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.sku}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{item.total_qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <ActivityFeed entries={recentActivity} />
      </div>
    </div>
  )
}
