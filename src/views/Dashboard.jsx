import { useMemo } from 'react'
import { useDashboard } from '../hooks/useDashboard.js'
import { useOrders } from '../hooks/useOrders.js'
import { useReceived } from '../hooks/useReceived.js'
import { useApproved } from '../hooks/useApproved.js'
import DashboardCard from '../components/DashboardCard.jsx'
import AlertsPanel from '../components/AlertsPanel.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'

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

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Loading dashboard...</div>
  }

  const pipelineStages = [
    { label: 'Ordered', count: pipelineCounts.ordered, color: 'bg-gray-200 text-gray-800' },
    { label: 'Received', count: pipelineCounts.received, color: 'bg-green-200 text-green-800' },
    { label: 'Testing', count: pipelineCounts.testing, color: 'bg-amber-200 text-amber-800' },
    { label: 'Approved', count: pipelineCounts.approved, color: 'bg-teal-200 text-teal-800' },
    { label: 'On Website', count: pipelineCounts.on_website, color: 'bg-blue-200 text-blue-800' },
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
      <div className="bg-white rounded-xl border border-gray-200 shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Overview</h3>
        <div className="flex items-center gap-1 overflow-x-auto">
          {pipelineStages.map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              <div className={`flex flex-col items-center px-4 py-3 rounded-xl ${stage.color} min-w-[100px]`}>
                <span className="text-2xl font-bold">{stage.count}</span>
                <span className="text-xs font-medium mt-0.5">{stage.label}</span>
              </div>
              {i < pipelineStages.length - 1 && (
                <svg className="w-5 h-5 text-gray-300 shrink-0 mx-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          ))}
        </div>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow p-6">
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
