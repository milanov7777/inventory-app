import { useMemo, useState } from 'react'
import { useCoaTracking } from '../hooks/useCoaTracking.js'
import Table from '../components/Table.jsx'

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
  const { rows, loading, error } = useCoaTracking()
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const age = daysAgo(r.last_tested)
      const isStale = r.last_tested == null || (age != null && age > 60)
      return { ...r, _ageDays: age, _isStale: isStale }
    })
  }, [rows])

  const filtered = useMemo(() => {
    let out = enriched
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
  }, [enriched, filter, statusFilter])

  const staleCount = enriched.filter((r) => r._isStale).length
  const swapCount = enriched.filter((r) => r.note_type === 'swap').length
  const noNextCount = enriched.filter((r) => r.note_type === 'warning').length

  const columns = [
    { key: 'sku', label: 'SKU', bold: true, sticky: true },
    { key: 'compound', label: 'Product', render: (v) => v || '—' },
    {
      key: 'last_tested',
      label: 'Last Tested',
      render: (v, row) => {
        if (!v) {
          return <span className="text-red-700 font-bold">Never tested</span>
        }
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">COAs — SKU Audit</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every SKU in your inventory with last-tested date, current live batch, and next-batch status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter(statusFilter === 'stale' ? 'all' : 'stale')}
            disabled={staleCount === 0}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
              statusFilter === 'stale'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            {staleCount} stale
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'swap' ? 'all' : 'swap')}
            disabled={swapCount === 0}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
              statusFilter === 'swap'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {swapCount} about to swap
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'no_next' ? 'all' : 'no_next')}
            disabled={noNextCount === 0}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold border disabled:opacity-40 ${
              statusFilter === 'no_next'
                ? 'bg-red-700 text-white border-red-700'
                : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
            }`}
          >
            {noNextCount} no next batch
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm px-3 py-2 rounded-md bg-red-50 text-red-800">{error}</div>
      )}

      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by SKU, product, or batch…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading SKU audit…</div>
      ) : (
        <Table
          columns={columns}
          rows={filtered}
          rowClassName={(row) => (row._isStale ? 'bg-red-50' : row.note_type === 'swap' ? 'bg-amber-50' : '')}
          emptyMessage={
            rows.length === 0
              ? 'No SKUs found in your inventory yet.'
              : 'No SKUs match your filters.'
          }
        />
      )}
    </div>
  )
}
