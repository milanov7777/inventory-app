/**
 * exportCsv(rows, columns, filename)
 *
 * rows    — already-filtered array of row objects
 * columns — [{ key, label }] matching UI columns
 * filename — e.g. 'orders-2024-01-15.csv'
 */
export function exportCsv(rows, columns, filename) {
  const escape = (val) => {
    const str = val == null ? '' : String(val)
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n')

  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
