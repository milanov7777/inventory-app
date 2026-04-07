import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { logAction } from '../utils/auditLogger.js'
import { notifySlack } from '../utils/slackNotify.js'

export function useOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setOrders(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  async function addOrder(payload, userName) {
    const { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'create',
      batchNumber: data.batch_number,
      stage: 'orders',
      changes: payload,
    })
    notifySlack('new_order', { batch_number: data.batch_number, user: userName })
    return data
  }

  async function updateOrder(id, payload, userName, batchNumber) {
    const { error } = await supabase.from('orders').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'update',
      batchNumber,
      stage: 'orders',
      changes: payload,
    })
  }

  async function deleteOrder(id, batchNumber, userName) {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logAction({
      userName,
      actionType: 'delete',
      batchNumber,
      stage: 'orders',
      changes: { deleted: true },
    })
  }

  return { orders, loading, error, addOrder, updateOrder, deleteOrder, refetch: fetchOrders }
}
