import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
    if (error) setError(error.message)
    else setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    const channel = supabase
      .channel(`audit-log-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, fetchEntries)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchEntries])

  return { entries, loading, error, refetch: fetchEntries }
}
