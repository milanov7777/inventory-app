import { useMemo, useState } from 'react'
import { useCoaTracking } from '../hooks/useCoaTracking.js'
import { useWooProducts } from '../hooks/useWooProducts.js'
import Table from '../components/Table.jsx'

const RETEST_DAYS = 180 // 6 months — flag COAs older than this for retesting

function fmtDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAge(days) {
  if (days == null) return '—'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

export default function Coas() {
  const { allCoas, loading, error } = useCoaTracking()
  const { wooProducts } = useWooProducts()
  const [filter, setFilter] = useState('')
  const [websiteFilter, setWebsiteFilter] = useState('all') // 'all' | 'live' | 'not_live' | 'retest_due' | 'missing_coa'

  // Build a Set of SKUs that are currently live on WooCommerce (instock)
  const liveSkus = useMemo(() => {
    const set = new Set()
    for (const p of wooProducts || []) {
      if (p.sku && p.stock_status === 'instock') set.add(p.sku.toUpperCase())
    }
    return set
  }, [wooProducts])

  // Annotate every COA with whether its SKU is live on WC
  // Then add synthetic rows for WC products that don't have any COA yet
  const annotatedCoas = useMemo(() => {
    const annotated = allCoas.map((c) => {
      const isOnWebsite = c.sku && liveSkus.has(c.sku.toUpperCase())
      return { ...c, on_website: isOnWebsite, _no_coa: false }
    })

    // Find WC SKUs that have NO COA in our records
    const skusWithCoa = new Set(annotated.map((c) => (c.sku || '').toUpperCase()).filter(Boolean))
    const missingRows = []
    for (const p of wooProducts || []) {
      const skuKey = (p.sku || '').toUpperCase()
      if (!skuKey || skusWithCoa.has(skuKey)) continue
      missingRows.push({
        id: `woo-${p.woo_id || p.sku}`,
        sku: p.sku,
        compound: p.name,
        batch_number: null,
        lab: null,
        date_tested: null,
        pass_fail: null,
        days_since_tested: null,
        on_website: p.stock_status === 'instock',
        _no_coa: true,
      })
    }
    return [...annotated, ...missingRows]
  }, [allCoas, liveSkus, wooProducts])

  const filteredAll = useMemo(() => {
    let out = annotatedCoas
    if (websiteFilter === 'live') out = out.filter((r) => r.on_website)
    else if (websiteFilter === 'not_live') out = out.filter((r) => !r.on_website)
    else if (websiteFilter === 'retest_due') out = out.filter((r) => r.on_website && !r._no_coa && (r.days_since_tested ?? 0) >= RETEST_DAYS)
    else if (websiteFilter === 'missing_coa') out = out.filter((r) => r.on_website && r._no_coa)
    const f = filter.trim().toLowerCase()
    if (f) {
      out = out.filter((r) =>
        [r.sku, r.compound, r.batch_number, r.lab].some((v) =>
          (v || '').toLowerCase().includes(f)
        )
      )
    }
    // Sort: retest due first, then live + has COA, then not live + has COA, then no COA at bottom
    out = [...out].sort((a, b) => {
      const urgA = a._no_coa ? 3 : a.on_website && (a.days_since_tested ?? 0) >= RETEST_DAYS ? 0 : a.on_website ? 1 : 2
      const urgB = b._no_coa ? 3 : b.on_website && (b.days_since_tested ?? 0) >= RETEST_DAYS ? 0 : b.on_website ? 1 : 2
      if (urgA !== urgB) return urgA - urgB
      return (b.date_tested || '').localeCompare(a.date_tested || '')
    })
    return out
  }, [annotatedCoas, filter, websiteFilter])

  const liveCount = annotatedCoas.filter((r) => r.on_website).length
  const retestDueCount = annotatedCoas.filter((r) => r.on_website && !r._no_coa && (r.days_since_tested ?? 0) >= RETEST_DAYS).length
  const missingCoaCount = annotatedCoas.filter((r) => r.on_website && r._no_coa).length

  const allColumns = [
    { key: 'sku', label: 'SKU', bold: true, sticky: true },
    { key: 'compound', label: 'Product', render: (v) => v || '—' },
    {
      key: 'batch_number',
      label: 'Batch #',
      render: (v, row) => row._no_coa
        ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">No COA on file</span>
        : <span className="font-mono text-xs">{v}</span>,
    },
    { key: 'lab', label: 'Lab', render: (v) => v || '—' },
    {
      key: 'date_tested',
      label: 'COA Date',
      render: (v, row) => v ? (
        <span>
          {fmtDate(v)}
          <span className="ml-2 text-xs text-gray-400">({fmtAge(row.days_since_tested)} ago)</span>
        </span>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'pass_fail',
      label: 'Result',
      render: (v, row) => {
        if (row._no_coa) return <span className="text-gray-400">—</span>
        return v ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v === 'pass' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>
            {v.toUpperCase()}
          </span>
        ) : <span className="text-gray-400 text-xs">Pending</span>
      },
    },
    {
      key: 'on_website',
      label: 'On WooCommerce',
      render: (_, row) => {
        if (row.on_website) {
          return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800 border border-green-300">🟢 LIVE</span>
        }
        return <span className="text-gray-400 text-xs">Not live</span>
      },
    },
    {
      key: 'time_up',
      label: 'Time Up',
      render: (_, row) => {
        if (!row.on_website) return <span className="text-gray-400 text-xs">—</span>
        const days = row.days_since_tested ?? 0
        if (days >= RETEST_DAYS) {
          return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">⚠️ Up {fmtAge(days)} — retest due</span>
        }
        return <span className="text-xs text-gray-700 font-medium">Up {fmtAge(days)}</span>
      },
    },
  ]

  // ---- Render ----
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">COAs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every batch with a COA on file. Live = currently listed on the website.</p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setWebsiteFilter(websiteFilter === 'live' ? 'all' : 'live')}
          disabled={liveCount === 0}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
            websiteFilter === 'live' ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          }`}
        >
          {liveCount} live now
        </button>
        <button
          onClick={() => setWebsiteFilter(websiteFilter === 'missing_coa' ? 'all' : 'missing_coa')}
          disabled={missingCoaCount === 0}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
            websiteFilter === 'missing_coa' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
          }`}
        >
          {missingCoaCount} no COA on file
        </button>
        <button
          onClick={() => setWebsiteFilter(websiteFilter === 'retest_due' ? 'all' : 'retest_due')}
          disabled={retestDueCount === 0}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
            websiteFilter === 'retest_due' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          }`}
        >
          {retestDueCount} retest due (6mo+)
        </button>
        <button
          onClick={() => setWebsiteFilter(websiteFilter === 'not_live' ? 'all' : 'not_live')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${
            websiteFilter === 'not_live' ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          Not on website
        </button>
      </div>

      {error && <div className="mb-3 text-sm px-3 py-2 rounded-md bg-red-50 text-red-800">{error}</div>}

      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by SKU, product, batch, or lab…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading COAs…</div>
      ) : (
        <Table
          columns={allColumns}
          rows={filteredAll}
          rowClassName={(row) => {
            if (row._no_coa) return 'bg-amber-50'
            if (row.on_website && (row.days_since_tested ?? 0) >= RETEST_DAYS) return 'bg-red-50'
            if (row.on_website) return 'bg-green-50'
            return ''
          }}
          emptyMessage={annotatedCoas.length === 0 ? 'No products yet.' : 'No products match your filters.'}
        />
      )}
    </div>
  )
}
