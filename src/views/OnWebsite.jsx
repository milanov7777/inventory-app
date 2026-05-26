import { useState, useMemo } from 'react'
import { useWooProducts } from '../hooks/useWooProducts.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import { exportCsv } from '../utils/exportCsv.js'
import { PRODUCT_CATALOG, PRODUCT_CATEGORIES } from '../utils/productCatalog.js'

const columns = [
  { key: 'sku', label: 'SKU', sticky: true, bold: true },
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category', render: (v) => v ? (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700 border border-brand-200">{v}</span>
  ) : '—' },
  { key: 'website_status', label: 'Website', render: (_, row) => {
    if (!row._onWebsite) {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-100 text-gray-500 border-gray-300">Not Listed</span>
    }
    if (row.stock_status === 'instock') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-green-100 text-green-700 border-green-300">In Stock</span>
    }
    if (row.stock_status === 'outofstock') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-100 text-red-700 border-red-300">Out of Stock</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-100 text-gray-600 border-gray-300">{row.stock_status || '—'}</span>
  } },
  { key: 'stock_quantity', label: 'Qty Live', render: (v, row) => row._onWebsite ? (v ?? 0) : '—' },
  { key: 'price', label: 'Price', render: (v, row) => row._onWebsite && v != null ? `$${Number(v).toFixed(2)}` : '—' },
]

const filterFields = [
  { key: 'search', label: 'Search SKU / Product', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: PRODUCT_CATEGORIES },
  { key: 'website_status', label: 'Website Status', type: 'select', options: ['In Stock', 'Out of Stock', 'Not Listed'] },
]

export default function OnWebsite() {
  const { wooProducts, wooLoading, refetchWoo } = useWooProducts()
  const [filters, setFilters] = useState({})

  // Build a SKU → WooCommerce product map (case-insensitive)
  const wooBySku = useMemo(() => {
    const map = {}
    ;(wooProducts || []).forEach((p) => {
      if (p.sku) map[p.sku.toUpperCase()] = p
    })
    return map
  }, [wooProducts])

  // Merge: every catalog entry shown, with WooCommerce data filled in when available.
  // Then add any WooCommerce SKUs that aren't in the catalog (so nothing is hidden).
  const allRows = useMemo(() => {
    const matchedWooSkus = new Set()

    const catalogRows = PRODUCT_CATALOG.map((c) => {
      const skuKey = c.sku.toUpperCase()
      const woo = wooBySku[skuKey]
      if (woo) matchedWooSkus.add(skuKey)
      return {
        id: woo ? `woo-${woo.woo_id}` : `cat-${c.sku}`,
        sku: c.sku,
        name: c.name,
        category: c.category,
        _onWebsite: !!woo,
        stock_status: woo?.stock_status || null,
        stock_quantity: woo?.stock_quantity ?? null,
        price: woo?.price ? Number(woo.price) : null,
        woo_id: woo?.woo_id || null,
      }
    })

    // WooCommerce products NOT in our catalog — surface them at the bottom so we don't hide anything
    const orphans = (wooProducts || [])
      .filter((p) => p.sku && !matchedWooSkus.has(p.sku.toUpperCase()))
      .map((p) => ({
        id: `woo-${p.woo_id || p.sku}`,
        sku: p.sku,
        name: p.name,
        category: 'Other',
        _onWebsite: true,
        _orphan: true,
        stock_status: p.stock_status,
        stock_quantity: p.stock_quantity,
        price: p.price ? Number(p.price) : null,
        woo_id: p.woo_id,
      }))

    return [...catalogRows, ...orphans]
  }, [wooBySku, wooProducts])

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      const s = filters.search?.toLowerCase() || ''
      if (s && !row.sku?.toLowerCase().includes(s) && !row.name?.toLowerCase().includes(s)) return false
      if (filters.category && row.category !== filters.category) return false
      if (filters.website_status) {
        const status =
          !row._onWebsite ? 'Not Listed'
          : row.stock_status === 'instock' ? 'In Stock'
          : row.stock_status === 'outofstock' ? 'Out of Stock'
          : null
        if (status !== filters.website_status) return false
      }
      return true
    })
  }, [allRows, filters])

  // Counts shown above the table
  const counts = useMemo(() => {
    const live = allRows.filter((r) => r._onWebsite && r.stock_status === 'instock').length
    const oos = allRows.filter((r) => r._onWebsite && r.stock_status === 'outofstock').length
    const missing = allRows.filter((r) => !r._onWebsite).length
    return { total: allRows.length, live, oos, missing }
  }, [allRows])

  function handleExport() {
    const exportColumns = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'website_status_text', label: 'Website Status' },
      { key: 'stock_quantity', label: 'Qty Live' },
      { key: 'price', label: 'Price' },
    ]
    const exportRows = filtered.map((r) => ({
      ...r,
      website_status_text: !r._onWebsite ? 'Not Listed' : r.stock_status === 'instock' ? 'In Stock' : r.stock_status === 'outofstock' ? 'Out of Stock' : (r.stock_status || ''),
    }))
    exportCsv(exportRows, exportColumns, 'on-website.csv')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">On Website</h2>
          <p className="text-xs text-gray-500 mt-1">Full product catalog. WooCommerce live data is merged in by SKU. Manage stock + pricing in WooCommerce.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetchWoo} disabled={wooLoading} className="text-sm px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 shadow-sm disabled:opacity-50">
            {wooLoading ? 'Syncing…' : 'Sync WooCommerce'}
          </button>
          <button onClick={handleExport} className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm">Export CSV</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-strong rounded-xl border border-white/50 shadow-sm p-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Catalog Total</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">{counts.total}</p>
        </div>
        <div className="glass-strong rounded-xl border border-green-200 shadow-sm p-3">
          <p className="text-[11px] font-medium text-green-700 uppercase tracking-wide">In Stock</p>
          <p className="mt-0.5 text-2xl font-bold text-green-700">{counts.live}</p>
        </div>
        <div className="glass-strong rounded-xl border border-red-200 shadow-sm p-3">
          <p className="text-[11px] font-medium text-red-700 uppercase tracking-wide">Out of Stock</p>
          <p className="mt-0.5 text-2xl font-bold text-red-700">{counts.oos}</p>
        </div>
        <div className="glass-strong rounded-xl border border-gray-200 shadow-sm p-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Not Listed Yet</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-700">{counts.missing}</p>
        </div>
      </div>

      <SearchFilter fields={filterFields} onFilter={setFilters} />

      {wooLoading && (wooProducts || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <svg className="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-sm text-gray-400">Syncing WooCommerce...</span>
        </div>
      ) : (
        <Table columns={columns} rows={filtered} emptyMessage="No products match your filters." />
      )}
    </div>
  )
}
