import { useMemo, useState } from 'react'
import { useCoaTracking } from '../hooks/useCoaTracking.js'
import { useWooProducts } from '../hooks/useWooProducts.js'
import Table from '../components/Table.jsx'

const RETEST_DAYS = 180 // 6 months — flag COAs older than this for retesting

function daysAgo(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
}

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

function NoteBadge({ type, text }) {
  const styles = {
    swap: 'bg-amber-100 text-amber-900 border-amber-300',
    in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-red-100 text-red-800 border-red-300',
    info: 'bg-gray-100 text-gray-700 border-gray-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-medium ${styles[type] || styles.info}`}>
      {text}
    </span>
  )
}

export default function Coas() {
  const { rows, allCoas, loading, error } = useCoaTracking()
  const { wooProducts, wooLoading } = useWooProducts()
  const [viewMode, setViewMode] = useState('all') // 'all' | 'by_sku'
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [websiteFilter, setWebsiteFilter] = useState('all') // 'all' | 'live' | 'not_live' | 'retest_due'

  // Build a Set of SKUs that are currently live on WooCommerce (instock)
  const liveSkus = useMemo(() => {
    const set = new Set()
    for (const p of wooProducts || []) {
      if (p.sku && p.stock_status === 'instock') set.add(p.sku.toUpperCase())
    }
    return set
  }, [wooProducts])

  // Annotate every COA with whether its SKU is live on WC
  const annotatedCoas = useMemo(() => {
    return allCoas.map((c) => {
      const isOnWebsite = c.sku && liveSkus.has(c.sku.toUpperCase())
      return { ...c, on_website: isOnWebsite }
    })
  }, [allCoas, liveSkus])

  // ---- BY SKU mode (existing) ----
  const enrichedSku = useMemo(() => {
    return rows.map((r) => {
      const age = daysAgo(r.last_tested)
      const isStale = r.last_tested == null || (age != null && age > 60)
      return { ...r, _ageDays: age, _isStale: isStale }
    })
  }, [rows])

  const filteredSku = useMemo(() => {
    let out = enrichedSku
    if (statusFilter === 'stale') out = out.filter((r) => r._isStale)
    else if (statusFilter === 'swap') out = out.filter((r) => r.note_type === 'swap')
    else if (statusFilter === 'no_next') out = out.filter((r) => r.note_type === 'warning')
    const f = filter.trim().toLowerCase()
    if (f) {
      out = out.filter((r) =>
        [r.sku, r.compound, r.current_batch, r.next_batch, r.last_tested_batch].some((v) =>
          (v || '').toLowerCase().includes(f)
        )
      )
    }
    return out
  }, [enrichedSku, filter, statusFilter])

  const staleCount = enrichedSku.filter((r) => r._isStale).length
  const swapCount = enrichedSku.filter((r) => r.note_type === 'swap').length
  const noNextCount = enrichedSku.filter((r) => r.note_type === 'warning').length

  const skuColumns = [
    { key: 'sku', label: 'SKU', bold: true, sticky: true },
    { key: 'compound', label: 'Product', render: (v) => v || '—' },
    {
      key: 'last_tested',
      label: 'Last Tested',
      render: (v, row) => {
        if (!v) return <span className="text-red-700 font-bold">Never tested</span>
        return (
          <span className={row._isStale ? 'text-red-700 font-bold' : ''}>
            {fmtDate(v)}
            {row._ageDays != null && (
              <span className={`ml-2 text-xs ${row._isStale ? 'text-red-600' : 'text-gray-400'}`}>
                ({row._ageDays}d ago)
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'last_tested_batch',
      label: 'Tested Batch',
      render: (v, row) => v ? (
        <span className="text-xs">
          <span className="font-mono">{v}</span>
          {row.last_tested_lab && <span className="text-gray-400 ml-1">({row.last_tested_lab})</span>}
        </span>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'current_batch',
      label: 'Current Batch (Live)',
      render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-gray-400">—</span>,
    },
    {
      key: 'notes',
      label: 'Status / Notes',
      render: (v, row) => <NoteBadge type={row.note_type} text={v} />,
    },
  ]

  // ---- ALL COAs mode (new) ----
  const filteredAll = useMemo(() => {
    let out = annotatedCoas
    if (websiteFilter === 'live') out = out.filter((r) => r.on_website)
    else if (websiteFilter === 'not_live') out = out.filter((r) => !r.on_website)
    else if (websiteFilter === 'retest_due') out = out.filter((r) => r.on_website && (r.days_since_tested ?? 0) >= RETEST_DAYS)
    const f = filter.trim().toLowerCase()
    if (f) {
      out = out.filter((r) =>
        [r.sku, r.compound, r.batch_number, r.lab].some((v) =>
          (v || '').toLowerCase().includes(f)
        )
      )
    }
    return out
  }, [annotatedCoas, filter, websiteFilter])

  const liveCount = annotatedCoas.filter((r) => r.on_website).length
  const retestDueCount = annotatedCoas.filter((r) => r.on_website && (r.days_since_tested ?? 0) >= RETEST_DAYS).length

  const allColumns = [
    { key: 'sku', label: 'SKU', bold: true, sticky: true },
    { key: 'compound', label: 'Product', render: (v) => v || '—' },
    { key: 'batch_number', label: 'Batch #', render: (v) => <span className="font-mono text-xs">{v}</span> },
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
      render: (v) => v ? (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v === 'pass' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>
          {v.toUpperCase()}
        </span>
      ) : <span className="text-gray-400 text-xs">Pending</span>,
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">COAs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {viewMode === 'all'
              ? 'Every batch with a COA on file. Live = currently listed on the website.'
              : 'Per-SKU summary: last tested date, current live batch, next batch in pipeline.'}
          </p>
        </div>

        {/* View toggle */}
        <div className="inline-flex bg-gray-100 rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All COAs
          </button>
          <button
            onClick={() => setViewMode('by_sku')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'by_sku' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            By SKU
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {viewMode === 'all' ? (
          <>
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
          </>
        ) : (
          <>
            <button
              onClick={() => setStatusFilter(statusFilter === 'stale' ? 'all' : 'stale')}
              disabled={staleCount === 0}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
                statusFilter === 'stale' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              {staleCount} stale
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'swap' ? 'all' : 'swap')}
              disabled={swapCount === 0}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
                statusFilter === 'swap' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {swapCount} about to swap
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'no_next' ? 'all' : 'no_next')}
              disabled={noNextCount === 0}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
                statusFilter === 'no_next' ? 'bg-red-700 text-white border-red-700' : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
              }`}
            >
              {noNextCount} no next batch
            </button>
          </>
        )}
      </div>

      {error && <div className="mb-3 text-sm px-3 py-2 rounded-md bg-red-50 text-red-800">{error}</div>}

      <div className="mb-3">
        <input
          type="text"
          placeholder={viewMode === 'all' ? 'Search by SKU, product, batch, or lab…' : 'Search by SKU, product, or batch…'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading COAs…</div>
      ) : viewMode === 'all' ? (
        <Table
          columns={allColumns}
          rows={filteredAll}
          rowClassName={(row) => {
            if (row.on_website && (row.days_since_tested ?? 0) >= RETEST_DAYS) return 'bg-red-50'
            if (row.on_website) return 'bg-green-50'
            return ''
          }}
          emptyMessage={allCoas.length === 0 ? 'No COAs on file yet.' : 'No COAs match your filters.'}
        />
      ) : (
        <Table
          columns={skuColumns}
          rows={filteredSku}
          rowClassName={(row) => (row._isStale ? 'bg-red-50' : row.note_type === 'swap' ? 'bg-amber-50' : '')}
          emptyMessage={rows.length === 0 ? 'No SKUs found in your inventory yet.' : 'No SKUs match your filters.'}
        />
      )}
    </div>
  )
}
