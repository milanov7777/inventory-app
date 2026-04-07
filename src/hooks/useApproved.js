import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'

export function useApproved() {
  const [approved, setApproved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchApproved = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('approved')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setApproved(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchApproved()
  }, [fetchApproved])

  useEffect(() => {
    const channel = supabase
      .channel(`approved-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approved' }, fetchApproved)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchApproved])

  async function addApproved(payload, userName) {
    const { data, error } = await supabase
      .from('approved')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'create',
      batchNumber: data.batch_number,
      stage: 'approved',
      changes: payload,
    })
    return data
  }

  async function updateApproved(id, payload, userName, batchNumber) {
    const { error } = await supabase.from('approved').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'update',
      batchNumber,
      stage: 'approved',
      changes: payload,
    })
  }

  async function deleteApproved(id, batchNumber, userName) {
    const { error } = await supabase.from('approved').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'delete',
      batchNumber,
      stage: 'approved',
      changes: { deleted: true },
    })
  }

  return { approved, loading, error, addApproved, updateApproved, deleteApproved, refetch: fetchApproved }
}
