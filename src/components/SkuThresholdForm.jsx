import { useState } from 'react'

export default function SkuThresholdForm({ skus, onSave }) {
  const [sku, setSku] = useState('')
  const [threshold, setThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sku || threshold === '') return
    setSaving(true)
    setError(null)
    try {
      await onSave(sku, Number(threshold))
      setSku('')
      setThreshold('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end mt-4 pt-4 border-t border-gray-100">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">SKU</label>
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-40"
        >
          <option value="">Select SKU</option>
          {skus.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Reorder Threshold (units)</label>
        <input
          type="number"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="e.g. 50"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={!sku || threshold === '' || saving}
        className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Set Threshold'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
