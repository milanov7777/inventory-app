import { useState } from 'react'

/**
 * columns: [{ key, label, render?, truncate?, sticky?, bold? }]
 * rows: array of objects
 * onEdit, onDelete, onPromote, onRowClick — all optional
 * promoteLabel, promotedLabel — button text
 * canPromote: (row) => boolean
 */
export default function Table({
  columns,
  rows,
  onEdit,
  onDelete,
  onPromote,
  onRowClick,
  promoteLabel = 'Promote',
  promotedLabel,
  canPromote,
  highlightRows,
  rowClassName,
  emptyMessage = 'No records found.',
}) {
  const [tooltip, setTooltip] = useState(null)

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">{emptyMessage}</div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow">
        <table className="min-w-full divide-y divide-gray-200 text-[14px]">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                    col.sticky ? 'sticky left-0 bg-gray-50 z-10' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || onPromote) && (
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide sticky right-0 bg-gray-50 z-10">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row, i) => {
              const isHighlighted = highlightRows && highlightRows.has(row.batch_number)
              const customClass = rowClassName ? rowClassName(row) : null
              return (
              <tr
                key={row.id || i}
                onClick={() => onRowClick && onRowClick(row)}
                className={`${
                  customClass
                    ? customClass
                    : isHighlighted
                      ? 'bg-amber-50 border-l-[3px] border-amber-400'
                      : `${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} border-l-2 border-transparent hover:border-blue-400`
                } hover:brightness-95 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => {
                  const value = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')
                  const isTruncated = col.truncate
                  const rawValue = row[col.key] ?? ''

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 text-gray-700 whitespace-nowrap ${
                        col.sticky ? 'sticky left-0 bg-inherit z-10' : ''
                      } ${col.bold ? 'font-semibold text-gray-900' : ''}`}
                    >
                      {isTruncated ? (
                        <span
                          className="block max-w-[150px] truncate"
                          title={String(rawValue)}
                          onMouseEnter={(e) => {
                            if (e.target.scrollWidth > e.target.clientWidth) {
                              setTooltip({ text: String(rawValue), x: e.clientX, y: e.clientY })
                            }
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  )
                })}
                {(onEdit || onDelete || onPromote) && (
                  <td className="px-4 py-3.5 text-right whitespace-nowrap sticky right-0 bg-inherit z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {onPromote && (() => {
                        const enabled = canPromote ? canPromote(row) : true
                        return (
                          <button
                            onClick={() => enabled && onPromote(row)}
                            disabled={!enabled}
                            title={enabled ? promoteLabel : (promotedLabel || 'Already promoted')}
                            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                              enabled
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {enabled ? `${promoteLabel} →` : (promotedLabel || `${promoteLabel} ✓`)}
                          </button>
                        )
                      })()}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {rows.map((row, i) => (
          <div
            key={row.id || i}
            onClick={() => onRowClick && onRowClick(row)}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2"
          >
            {columns.map((col) => {
              const value = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')
              return (
                <div key={col.key} className="flex justify-between items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 shrink-0">{col.label}</span>
                  <span className={`text-sm text-right ${col.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {value}
                  </span>
                </div>
              )
            })}
            {(onEdit || onDelete || onPromote) && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {onPromote && (() => {
                  const enabled = canPromote ? canPromote(row) : true
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); enabled && onPromote(row) }}
                      disabled={!enabled}
                      className={`flex-1 text-xs py-2 rounded-lg font-semibold ${
                        enabled ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {enabled ? `${promoteLabel} →` : (promotedLabel || `${promoteLabel} ✓`)}
                    </button>
                  )
                })()}
                {onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} className="px-3 py-2 text-xs rounded-lg bg-blue-50 text-blue-700">Edit</button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(row) }} className="px-3 py-2 text-xs rounded-lg bg-red-50 text-red-700">Delete</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-sm pointer-events-none"
          style={{ top: tooltip.y - 40, left: tooltip.x }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
