const colorMap = {
  ordered:    'bg-gray-200 text-gray-800',
  received:   'bg-green-200 text-green-900',
  in_testing: 'bg-amber-200 text-amber-900',
  approved:   'bg-teal-200 text-teal-900',
  live:       'bg-blue-200 text-blue-900',
  failed:     'bg-red-200 text-red-900',
}

const labelMap = {
  ordered:    'Ordered',
  received:   'Received',
  in_testing: 'In Testing',
  approved:   'Approved',
  live:       'On Website',
  failed:     'Failed',
}

export default function Badge({ status }) {
  const colors = colorMap[status] || 'bg-gray-200 text-gray-700'
  const label = labelMap[status] || status
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${colors}`}>
      {label}
    </span>
  )
}
