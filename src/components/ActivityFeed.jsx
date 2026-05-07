import { formatDatetime } from '../utils/formatDate.js'

const dotColors = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  promote: 'bg-purple-500',
}

export default function ActivityFeed({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="glass-strong rounded-xl border border-white/50 shadow-lg shadow-brand-500/5 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
        <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="glass-strong rounded-xl border border-white/50 shadow-lg shadow-brand-500/5 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
      <ul className="space-y-3 relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-200 via-brand-100 to-transparent" />
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 text-sm relative pl-6">
            {/* Colored dot */}
            <span
              className={`absolute left-0 top-1.5 w-[14px] h-[14px] rounded-full border-2 border-white shadow-sm shrink-0 ${
                dotColors[entry.action_type] || 'bg-gray-400'
              }`}
            />
            <div className="min-w-0">
              <p className="text-gray-800">
                <span className="font-medium">{entry.user_name}</span>
                <span className="text-xs text-gray-400 ml-1.5 capitalize">{entry.action_type}</span>
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
