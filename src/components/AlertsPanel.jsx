import SkuThresholdForm from './SkuThresholdForm.jsx'

export default function AlertsPanel({ lowStockItems, thresholds, onUpdateThreshold, user, allSkus }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Low Stock Alerts</h3>
        {lowStockItems.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            {lowStockItems.length} alert{lowStockItems.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {lowStockItems.length === 0 ? (
        <p className="text-sm text-gray-400">
          {thresholds.length === 0
            ? 'No reorder thresholds set yet.'
            : 'All SKUs are above their reorder thresholds.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-red-100">
          <table className="min-w-full text-sm divide-y divide-red-50">
            <thead className="bg-red-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-red-600 uppercase">SKU</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-red-600 uppercase">On Hand</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-red-600 uppercase">Reorder At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-red-50">
              {lowStockItems.map((item) => (
                <tr key={item.sku} className="bg-red-50/30">
                  <td className="px-4 py-2 font-medium text-red-800">{item.sku}</td>
                  <td className="px-4 py-2 text-right text-red-700 font-bold">{item.total_qty}</td>
                  <td className="px-4 py-2 text-right text-red-500">{item.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {user === 'Admin' && (
        <SkuThresholdForm
          skus={allSkus}
          onSave={(sku, threshold) => onUpdateThreshold(sku, threshold, user)}
        />
      )}
    </div>
  )
}
