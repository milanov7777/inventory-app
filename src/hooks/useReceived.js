import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'

export function useReceived() {
  const [received, setReceived] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReceived = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('received')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setReceived(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReceived()
  }, [fetchReceived])

  useEffect(() => {
    const channel = supabase
      .channel(`received-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'received' }, fetchReceived)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchReceived])

  async function addReceived(payload, userName) {
    const { data, error } = await supabase
      .from('received')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'create',
      batchNumber: data.batch_number,
      stage: 'received',
      changes: payload,
    })
    return data
  }

  async function updateReceived(id, payload, userName, batchNumber) {
    const { error } = await supabase.from('received').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'update',
      batchNumber,
      stage: 'received',
      changes: payload,
    })
  }

  async function deleteReceived(id, batchNumber, userName) {
    const { error } = await supabase.from('received').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'delete',
      batchNumber,
      stage: 'received',
      changes: { deleted: true },
    })
  }

  return { received, loading, error, addReceived, updateReceived, deleteReceived, refetch: fetchReceived }
}
