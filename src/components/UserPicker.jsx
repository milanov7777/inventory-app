import { useState } from 'react'
import { USERS } from '../utils/stageConfig.js'

export default function UserPicker({ onSelect }) {
  const [selected, setSelected] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (selected) onSelect(selected)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Select your name to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full text-base border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 bg-white transition-colors"
          >
            <option value="">— Choose your name —</option>
            {USERS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selected}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
