import { useState } from 'react'

/**
 * fields: [{ key, label, type: 'text' | 'select' | 'date-range', options?: string[] }]
 * onFilter: (filterState) => void  — called on every change
 */
export default function SearchFilter({ fields, onFilter }) {
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach((f) => {
      if (f.type === 'date-range') {
        init[f.key + '_from'] = ''
        init[f.key + '_to'] = ''
      } else {
        init[f.key] = ''
      }
    })
    return init
  })

  function handleChange(key, value) {
    const next = { ...values, [key]: value }
    setValues(next)
    onFilter(next)
  }

  function handleReset() {
    const cleared = {}
    Object.keys(values).forEach((k) => (cleared[k] = ''))
    setValues(cleared)
    onFilter(cleared)
  }

  const hasValues = Object.values(values).some(Boolean)

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {fields.map((field) => {
        if (field.type === 'text') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <input
                type="text"
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder || `Search by SKU or compound...`}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 w-56 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )
        }
        if (field.type === 'select') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{field.label}</label>
              <select
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              >
                <option value="">All</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )
        }
        if (field.type === 'date-range') {
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{field.label}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={values[field.key + '_from']}
                  onChange={(e) => handleChange(field.key + '_from', e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={values[field.key + '_to']}
                  onChange={(e) => handleChange(field.key + '_to', e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
          )
        }
        return null
      })}
      {hasValues && (
        <button
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
