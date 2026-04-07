const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const datetimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatDate(isoString) {
  if (!isoString) return '—'
  return dateFormatter.format(new Date(isoString))
}

export function formatDatetime(isoString) {
  if (!isoString) return '—'
  return datetimeFormatter.format(new Date(isoString))
}

export function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}
