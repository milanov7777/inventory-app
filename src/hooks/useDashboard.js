import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useDashboard() {
  const [stats, setStats] = useState({ uniqueSkus: 0, totalUnits: 0, totalValue: 0 })
  const [lowStock, setLowStock] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // Run all queries in parallel
    const [skuRes, approvedRes, receivedRes, ordersRes, activityRes, thresholdRes, skuSummaryRes] =
      await Promise.all([
        supabase.from('orders').select('sku'),
        supabase.from('approved').select('qty_available'),
        supabase.from('received').select('qty_received'),
        supabase
          .from('orders')
          .select('total_value, status')
          .in('status', ['received', 'in_testing', 'approved', 'live']),
        supabase
          .from('audit_log')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10),
        supabase.from('sku_thresholds').select('*'),
        supabase.from('sku_qty_summary').select('*'),
      ])

    // Unique SKUs
    const uniqueSkus = new Set((skuRes.data || []).map((r) => r.sku)).size

    // Total units on hand: approved qty_available + received qty_received
    const approvedUnits = (approvedRes.data || []).reduce((s, r) => s + (r.qty_available || 0), 0)
    const receivedUnits = (receivedRes.data || []).reduce((s, r) => s + (r.qty_received || 0), 0)
    const totalUnits = approvedUnits + receivedUnits

    // Total inventory value at cost
    const totalValue = (ordersRes.data || []).reduce((s, r) => s + (r.total_value || 0), 0)

    setStats({ uniqueSkus, totalUnits, totalValue })
    setRecentActivity(activityRes.data || [])

    // Low stock: compare sku_qty_summary to thresholds
    const thresh = thresholdRes.data || []
    const qtyBySku = {}
    ;(skuSummaryRes.data || []).forEach((r) => {
      qtyBySku[r.sku] = Number(r.total_qty) || 0
    })

    const alerts = thresh
      .filter((t) => (qtyBySku[t.sku] ?? 0) < t.reorder_threshold)
      .map((t) => ({
        sku: t.sku,
        total_qty: qtyBySku[t.sku] ?? 0,
        threshold: t.reorder_threshold,
      }))

    setLowStock(alerts)
    setThresholds(thresh)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Re-fetch when any relevant table changes
  useEffect(() => {
    const tables = ['orders', 'approved', 'received', 'audit_log', 'sku_thresholds']
    const channels = tables.map((table) =>
      supabase
        .channel(`dashboard-${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, fetchAll)
        .subscribe()
    )
    return () => channels.forEach((ch) => supabase.removeChannel(ch))
  }, [fetchAll])

  async function updateThreshold(sku, threshold, updatedBy) {
    const { error } = await supabase
      .from('sku_thresholds')
      .upsert({ sku, reorder_threshold: threshold, updated_by: updatedBy, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
  }

  return { stats, lowStock, thresholds, recentActivity, loading, updateThreshold, refetch: fetchAll }
}
