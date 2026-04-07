import { useMemo, useState } from 'react'
import { useAuditLog } from '../hooks/useAuditLog.js'
import Table from '../components/Table.jsx'
import SearchFilter from '../components/SearchFilter.jsx'
import { formatDatetime } from '../utils/formatDate.js'
import { exportCsv } from '../utils/exportCsv.js'

const columns = [
  { key: 'timestamp', label: 'Timestamp', render: (v) => formatDatetime(v) },
  { key: 'user_name', label: 'User' },
  { key: 'action_type', label: 'Action' },
  { key: 'batch_number', label: 'Batch #' },
  { key: 'stage', label: 'Stage' },
  {
    key: 'changes_json',
    label: 'Details',
    render: (v) => (
      <span className="font-mono text-xs text-gray-500 max-w-xs block truncate">
        {v ? JSON.stringify(v) : '—'}
      </span>
    ),
  },
]

const filterFields = [
  { key: 'user_name', label: 'User', type: 'select', options: ['Camila', 'Aiden', 'Peyton', 'Admin'] },
  { key: 'action_type', label: 'Action', type: 'select', options: ['create', 'update', 'delete', 'promote'] },
  { key: 'stage', label: 'Stage', type: 'select', options: ['orders', 'received', 'testing', 'approved', 'on_website'] },
  { key: 'timestamp', label: 'Date Range', type: 'date-range' },
]

export default function AuditLog() {
  const { entries, loading, error } = useAuditLog()
  const [filters, setFilters] = useState({})

  const filtered = useMemo(() => {
    return entries.filter((row) => {
      if (filters.user_name && row.user_name !== filters.user_name) return false
      if (filters.action_type && row.action_type !== filters.action_type) return false
      if (filters.stage && row.stage !== filters.stage) return false
      if (filters.timestamp_from && row.timestamp < filters.timestamp_from) return false
      if (filters.timestamp_to && row.timestamp > filters.timestamp_to + 'T23:59:59') return false
      return true
    })
  }, [entries, filters])

  function handleExport() {
    exportCsv(
      filtered.map((r) => ({ ...r, changes_json: JSON.stringify(r.changes_json) })),
      columns.map((c) => ({ key: c.key, label: c.label })),
      'audit-log.csv'
    )
  }

  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Audit Log</h2>
        <button
          onClick={handleExport}
          className="text-sm px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          Export CSV
        </button>
      </div>
      <SearchFilter fields={filterFields} onFilter={setFilters} />
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <Table
          columns={columns}
          rows={filtered}
          emptyMessage="No audit log entries found."
        />
      )}
    </div>
  )
}
