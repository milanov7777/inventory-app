import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

export function useForecasting() {
  const [metrics, setMetrics] = useState([])
  const [wooStock, setWooStock] = useState([])
  const [leadTimes, setLeadTimes] = useState([])
  const [syncMeta, setSyncMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [metricsRes, wooRes, leadRes, metaRes] = await Promise.all([
        supabase.rpc('get_forecast_metrics'),
        supabase.functions.invoke('woo-products'),
        supabase.from('vendor_lead_times').select('*').order('vendor_name'),
        supabase.from('sync_metadata').select('*'),
      ])
      if (metricsRes.data) setMetrics(Array.isArray(metricsRes.data) ? metricsRes.data : [])
      if (wooRes.data) setWooStock(Array.isArray(wooRes.data) ? wooRes.data : [])
      if (leadRes.data) setLeadTimes(leadRes.data)
      if (metaRes.data) {
        const m = {}
        metaRes.data.forEach((r) => { m[r.key] = r.value })
        setSyncMeta(m)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Sync WooCommerce orders — loops until has_more is false
  async function syncNow(mode = 'initial') {
    setSyncing(true)
    setSyncProgress('Starting sync...')
    let totalRows = 0
    let totalPages = 0
    try {
      let hasMore = true
      while (hasMore) {
        const { data, error: fnErr } = await supabase.functions.invoke('woo-sync-orders', {
          body: { mode },
        })
        if (fnErr) throw new Error(fnErr.message)
        totalRows += data?.rows_inserted || 0
        totalPages += data?.pages_processed || 0
        hasMore = data?.has_more === true
        setSyncProgress(`Synced ${totalPages} pages (${totalRows} line items)...`)
        if (data?.rate_limited) {
          setSyncProgress(`Rate limited — waiting 10s... (${totalPages} pages so far)`)
          await new Promise((r) => setTimeout(r, 10000))
        }
      }
      setSyncProgress(`Done! ${totalPages} pages, ${totalRows} line items`)
      await fetchAll()
    } catch (err) {
      setSyncProgress(`Error: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // CRUD for vendor lead times
  async function addLeadTime(payload, userName) {
    const { error } = await supabase.from('vendor_lead_times').insert({ ...payload, updated_by: userName })
    if (error) throw new Error(error.message)
    await fetchAll()
  }

  async function updateLeadTime(id, payload, userName) {
    const { error } = await supabase.from('vendor_lead_times').update({ ...payload, updated_by: userName, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
    await fetchAll()
  }

  async function deleteLeadTime(id) {
    const { error } = await supabase.from('vendor_lead_times').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetchAll()
  }

  // Build enriched forecast data by joining metrics with stock levels
  const forecast = useMemo(() => {
    const stockMap = {}
    wooStock.forEach((p) => {
      if (p.sku) stockMap[p.sku.toUpperCase()] = p
    })

    // Build vendor lead time lookup: sku-specific first, then vendor default
    const skuLeadTime = {}
    const vendorDefaults = {}
    leadTimes.forEach((lt) => {
      if (lt.sku) {
        skuLeadTime[lt.sku.toUpperCase()] = lt.lead_time_days
      } else {
        vendorDefaults[lt.vendor_name.toLowerCase()] = lt.lead_time_days
      }
    })
    const defaultLeadTime = Math.max(...Object.values(vendorDefaults), 14)

    return metrics.map((m) => {
      const stock = stockMap[m.sku.toUpperCase()]
      const currentStock = stock?.stock_quantity ?? 0
      const burn30 = Number(m.burn_30d) || 0
      const burn7 = Number(m.burn_7d) || 0
      const burn14 = Number(m.burn_14d) || 0
      const leadTime = skuLeadTime[m.sku.toUpperCase()] ?? defaultLeadTime

      // Days remaining based on 30d burn rate
      const daysRemaining = burn30 > 0 ? Math.round(currentStock / burn30) : 9999

      // Accelerated days remaining (uses 7d rate if it's higher)
      const effectiveBurn = Math.max(burn7, burn30)
      const daysRemainingAccelerated = effectiveBurn > 0 ? Math.round(currentStock / effectiveBurn) : 9999

      // Trend: compare 7d rate to 30d rate
      let trendPct = 0
      let trendDir = 'steady'
      if (burn30 > 0) {
        trendPct = Math.round(((burn7 - burn30) / burn30) * 100)
        if (trendPct > 15) trendDir = 'up'
        else if (trendPct < -15) trendDir = 'down'
      }

      // Week-over-week trend (last 2 weeks)
      const weeks = m.recent_weeks || []
      let wowChange = 0
      if (weeks.length >= 2) {
        const thisWeek = weeks[0]?.qty || 0
        const lastWeek = weeks[1]?.qty || 0
        wowChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0
      }

      // Consecutive weeks trending up
      let consecutiveUp = 0
      for (let i = 0; i < weeks.length - 1; i++) {
        if ((weeks[i]?.qty || 0) > (weeks[i + 1]?.qty || 0)) consecutiveUp++
        else break
      }

      // Status
      let status = 'ok'
      if (daysRemaining <= leadTime) status = 'overdue'
      else if (daysRemaining <= 45) status = 'low'
      else if (daysRemaining <= 90) status = 'order_soon'

      // Is new product (first sale within 60 days)
      const firstSale = m.first_sale ? new Date(m.first_sale) : null
      const isNew = firstSale && (Date.now() - firstSale.getTime()) < 60 * 24 * 60 * 60 * 1000

      // Suggested reorder qty (target 90 days of stock)
      const reorderQty = Math.max(0, Math.round(90 * burn30 - currentStock))

      // Reorder by date
      const reorderByDays = Math.max(0, daysRemaining - leadTime)
      const reorderByDate = new Date()
      reorderByDate.setDate(reorderByDate.getDate() + reorderByDays)

      return {
        ...m,
        currentStock,
        stockStatus: stock?.stock_status || 'unknown',
        leadTime,
        daysRemaining,
        daysRemainingAccelerated,
        trendPct,
        trendDir,
        wowChange,
        consecutiveUp,
        status,
        isNew,
        reorderQty,
        reorderByDate: reorderByDate.toISOString().split('T')[0],
      }
    }).sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [metrics, wooStock, leadTimes])

  // Generate smart flags
  const flags = useMemo(() => {
    const f = []
    forecast.forEach((item) => {
      // Surge: 7d rate significantly above 30d rate
      if (item.trendDir === 'up' && item.trendPct >= 25 && Number(item.burn_7d) > 0.5) {
        f.push({
          type: 'surge',
          severity: item.status === 'low' || item.status === 'overdue' ? 'critical' : 'warning',
          sku: item.sku,
          title: `${item.product_name} surging`,
          detail: `7-day burn rate is ${item.trendPct}% above the 30-day average (${item.burn_7d}/day vs ${item.burn_30d}/day). ${item.daysRemainingAccelerated} days at current pace.`,
        })
      }

      // Sustained climb: 3+ consecutive weeks increasing
      if (item.consecutiveUp >= 3) {
        f.push({
          type: 'climb',
          severity: 'info',
          sku: item.sku,
          title: `${item.product_name} — ${item.consecutiveUp} weeks climbing`,
          detail: `Sales have increased for ${item.consecutiveUp} consecutive weeks. Current rate: ${item.burn_7d}/day.`,
        })
      }

      // Danger acceleration: flat burn says OK but accelerated burn says danger
      if (item.daysRemaining > 45 && item.daysRemainingAccelerated <= 45 && Number(item.burn_7d) > Number(item.burn_30d)) {
        f.push({
          type: 'danger_accel',
          severity: 'critical',
          sku: item.sku,
          title: `${item.product_name} may hit danger zone early`,
          detail: `30-day rate shows ${item.daysRemaining} days left, but recent acceleration cuts it to ${item.daysRemainingAccelerated} days. Consider reordering now.`,
        })
      }

      // Low stock / overdue
      if (item.status === 'overdue') {
        f.push({
          type: 'overdue',
          severity: 'critical',
          sku: item.sku,
          title: `${item.product_name} — REORDER OVERDUE`,
          detail: `Only ${item.daysRemaining} days of stock left. Lead time is ${item.leadTime} days. Reorder ${item.reorderQty} units immediately.`,
        })
      } else if (item.status === 'low') {
        f.push({
          type: 'low',
          severity: 'warning',
          sku: item.sku,
          title: `${item.product_name} — low stock`,
          detail: `${item.daysRemaining} days remaining. Suggested reorder: ${item.reorderQty} units by ${item.reorderByDate}.`,
        })
      }

      // New product ramp
      if (item.isNew && Number(item.burn_7d) > 0) {
        f.push({
          type: 'new',
          severity: 'info',
          sku: item.sku,
          title: `${item.product_name} — new product`,
          detail: `Launched recently. Currently selling ${item.burn_7d}/day. Week-over-week: ${item.wowChange > 0 ? '+' : ''}${item.wowChange}%.`,
        })
      }

      // Cooling off: significant slowdown
      if (item.trendDir === 'down' && item.trendPct <= -30 && Number(item.burn_30d) > 0.5) {
        f.push({
          type: 'cooling',
          severity: 'info',
          sku: item.sku,
          title: `${item.product_name} cooling off`,
          detail: `7-day rate is ${Math.abs(item.trendPct)}% below the 30-day average. Avoid over-ordering.`,
        })
      }
    })
    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return f.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }, [forecast])

  return {
    forecast,
    flags,
    leadTimes,
    syncMeta,
    loading,
    syncing,
    syncProgress,
    error,
    syncNow,
    addLeadTime,
    updateLeadTime,
    deleteLeadTime,
    refetch: fetchAll,
  }
}
