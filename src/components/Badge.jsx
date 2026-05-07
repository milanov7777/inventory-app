const colorMap = {
  ordered:    'bg-gray-100 text-gray-800 border border-gray-300',
  received:   'bg-green-100 text-green-900 border border-green-300',
  in_testing: 'bg-amber-100 text-amber-900 border border-amber-300',
  approved:   'bg-teal-100 text-teal-900 border border-teal-300',
  live:       'bg-blue-100 text-blue-900 border border-blue-300',
  failed:     'bg-red-100 text-red-900 border border-red-300',
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
  const colors = colorMap[status] || 'bg-gray-100 text-gray-700 border border-gray-300'
  const label = labelMap[status] || status
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${colors}`}>
      {label}
    </span>
  )
}
