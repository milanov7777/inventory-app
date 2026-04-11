import { STAGES } from '../utils/stageConfig.js'

export default function TabBar({ activeKey, onChange, counts = {} }) {
  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="flex min-w-max">
        {STAGES.map((stage) => {
          const isActive = stage.key === activeKey
          const count = counts[stage.key]
          return (
            <button
              key={stage.key}
              onClick={() => onChange(stage.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                isActive
                  ? 'border-brand-600 text-brand-700 bg-brand-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${stage.color}`} />
              {stage.label}
              {count != null && count > 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-brand-200 text-brand-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
