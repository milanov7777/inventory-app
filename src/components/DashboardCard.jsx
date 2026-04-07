export default function DashboardCard({ label, value, color = 'border-gray-400', sub }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${color} p-5`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
