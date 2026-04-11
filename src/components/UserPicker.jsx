import { useState } from 'react'
import { USERS } from '../utils/stageConfig.js'
import { supabase } from '../lib/supabase.js'
import { hashPin } from '../utils/hashPin.js'

export default function UserPicker({ onSelect }) {
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected || !pin) return
    setError('')
    setVerifying(true)
    try {
      const { data, error: dbErr } = await supabase
        .from('users')
        .select('pin_hash, role')
        .eq('username', selected)
        .single()
      if (dbErr || !data) {
        setError('User not found. Contact Admin.')
        return
      }
      const hashed = await hashPin(pin)
      if (hashed !== data.pin_hash) {
        setError('Wrong PIN. Try again.')
        return
      }
      onSelect(selected, data.role)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-100 via-purple-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Select your name and enter your PIN</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); setError(''); setPin('') }}
            className="w-full text-base border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 bg-white transition-colors"
          >
            <option value="">— Choose your name —</option>
            {USERS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {selected && (
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
              className="w-full text-base text-center tracking-[0.3em] border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 bg-white transition-colors"
              autoFocus
            />
          )}
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={!selected || !pin || verifying}
            className="w-full py-3 px-4 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Verifying…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
