import { formatDatetime } from '../utils/formatDate.js'

const actionColors = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  promote: 'bg-purple-100 text-purple-700',
}

export default function ActivityFeed({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
        <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                actionColors[entry.action_type] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {entry.action_type}
            </span>
            <div className="min-w-0">
              <p className="text-gray-800">
                <span className="font-medium">{entry.user_name}</span>
                {entry.batch_number && (
                  <>
                    {' — '}
                    <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                      {entry.batch_number}
                    </span>
                  </>
                )}
                {entry.stage && (
                  <span className="text-gray-400"> in {entry.stage}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDatetime(entry.timestamp)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
