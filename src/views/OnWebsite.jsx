import { useState, useMemo } from 'react'
import { useWooProducts } from '../hooks/useWooProducts.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import { exportCsv } from '../utils/exportCsv.js'

const columns = [
  { key: 'sku', label: 'SKU', sticky: true },
  { key: 'name', label: 'Product', bold: true },
  { key: 'stock_status', label: 'Stock', render: (v) => {
    const label = v === 'instock' ? 'In Stock' : v === 'outofstock' ? 'Out of Stock' : (v || '—')
    const color = v === 'instock' ? 'bg-green-100 text-green-700 border-green-300'
                : v === 'outofstock' ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>{label}</span>
  } },
  { key: 'stock_quantity', label: 'Qty Live' },
  { key: 'price', label: 'Price', render: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Product', type: 'text' },
  { key: 'stock_status', label: 'Stock Status', type: 'select', options: ['instock', 'outofstock'] },
]

// Sort by most recently added — WooCommerce IDs are auto-increment, so higher = newer
const recencyComparator = (a, b) => Number(b.woo_id || 0) - Number(a.woo_id || 0)

export default function OnWebsite() {
  const { wooProducts, wooLoading, refetchWoo } = useWooProducts()
  const [filters, setFilters] = useState({})

  const filtered = useMemo(() => {
    const rows = (wooProducts || []).filter((p) => {
      const s = filters.search?.toLowerCase() || ''
      if (s && !p.sku?.toLowerCase().includes(s) && !p.name?.toLowerCase().includes(s)) return false
      if (filters.stock_status && p.stock_status !== filters.stock_status) return false
      return true
    })
    rows.sort(recencyComparator)
    return rows.map((p) => ({
      id: `woo-${p.woo_id || p.sku}`,
      woo_id: p.woo_id,
      sku: p.sku,
      name: p.name,
      stock_status: p.stock_status,
      stock_quantity: p.stock_quantity,
      price: p.price ? Number(p.price) : null,
    }))
  }, [wooProducts, filters])

  function handleExport() {
    exportCsv(filtered, columns.map((c) => ({ key: c.key, label: c.label })), 'on-website.csv')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">On Website</h2>
          <p className="text-xs text-gray-500 mt-1">Live products on the WooCommerce store. Read-only mirror — manage stock + pricing in WooCommerce.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetchWoo} disabled={wooLoading} className="text-sm px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 shadow-sm disabled:opacity-50">
            {wooLoading ? 'Syncing…' : 'Sync WooCommerce'}
          </button>
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
        </div>
      </div>

      <SearchFilter fields={filterFields} onFilter={setFilters} />

      {wooLoading && (wooProducts || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <svg className="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-sm text-gray-400">Syncing WooCommerce...</span>
        </div>
      ) : (
        <Table columns={columns} rows={filtered} emptyMessage="No live products yet. Click 'Sync WooCommerce' to load." />
      )}
    </div>
  )
}
