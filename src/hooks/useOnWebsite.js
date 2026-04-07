import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'

export function useOnWebsite() {
  const [onWebsite, setOnWebsite] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOnWebsite = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('on_website')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setOnWebsite(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOnWebsite()
  }, [fetchOnWebsite])

  useEffect(() => {
    const channel = supabase
      .channel(`on_website-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'on_website' }, fetchOnWebsite)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOnWebsite])

  async function addOnWebsite(payload, userName) {
    const { data, error } = await supabase
      .from('on_website')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'create',
      batchNumber: data.batch_number,
      stage: 'on_website',
      changes: payload,
    })
    return data
  }

  async function updateOnWebsite(id, payload, userName, batchNumber) {
    const { error } = await supabase.from('on_website').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'update',
      batchNumber,
      stage: 'on_website',
      changes: payload,
    })
  }

  async function deleteOnWebsite(id, batchNumber, userName) {
    const { error } = await supabase.from('on_website').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'delete',
      batchNumber,
      stage: 'on_website',
      changes: { deleted: true },
    })
  }

  return { onWebsite, loading, error, addOnWebsite, updateOnWebsite, deleteOnWebsite, refetch: fetchOnWebsite }
}
