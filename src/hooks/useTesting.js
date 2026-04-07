import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'

export function useTesting() {
  const [testing, setTesting] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTesting = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('testing')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTesting(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTesting()
  }, [fetchTesting])

  useEffect(() => {
    const channel = supabase
      .channel(`testing-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testing' }, fetchTesting)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchTesting])

  async function addTesting(payload, userName) {
    const { data, error } = await supabase
      .from('testing')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'create',
      batchNumber: data.batch_number,
      stage: 'testing',
      changes: payload,
    })
    return data
  }

  async function updateTesting(id, payload, userName, batchNumber) {
    const { error } = await supabase.from('testing').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'update',
      batchNumber,
      stage: 'testing',
      changes: payload,
    })
  }

  async function deleteTesting(id, batchNumber, userName) {
    const { error } = await supabase.from('testing').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'delete',
      batchNumber,
      stage: 'testing',
      changes: { deleted: true },
    })
  }

  return { testing, loading, error, addTesting, updateTesting, deleteTesting, refetch: fetchTesting }
}
