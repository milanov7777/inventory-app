import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function BurnRateChart({ item }) {
  if (!item) return null

  const data = [
    { window: '7d', rate: Number(item.burn_7d) || 0 },
    { window: '14d', rate: Number(item.burn_14d) || 0 },
    { window: '30d', rate: Number(item.burn_30d) || 0 },
    { window: '60d', rate: Number(item.burn_60d) || 0 },
    { window: '90d', rate: Number(item.burn_90d) || 0 },
    { window: '180d', rate: Number(item.burn_180d) || 0 },
  ]

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Burn Rate (units/day)</h4>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="window" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v.toFixed(2)} / day`, 'Burn Rate']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
