import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

const NEXT_BATCH_PRIORITY = ['approved', 'in_testing', 'received', 'ordered']
const STAGE_LABEL = {
  approved: 'Approved',
  in_testing: 'In Testing',
  received: 'Received',
  ordered: 'Ordered',
}

function buildAuditRows({ orders, testing }) {
  const testingByBatch = new Map()
  for (const t of testing) {
    const existing = testingByBatch.get(t.batch_number)
    const ts = t.date_results_received || t.created_at
    const existingTs = existing ? (existing.date_results_received || existing.created_at) : null
    if (!existing || (ts && (!existingTs || ts > existingTs))) {
      testingByBatch.set(t.batch_number, t)
    }
  }

  const skuMap = new Map()
  for (const o of orders) {
    if (!skuMap.has(o.sku)) skuMap.set(o.sku, [])
    skuMap.get(o.sku).push(o)
  }

  const rows = []
  for (const [sku, batches] of skuMap.entries()) {
    const sorted = [...batches].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    const compound = sorted[0]?.compound_mg || ''

    const liveBatches = sorted.filter((b) => b.status === 'live')
    const currentBatch = liveBatches[0] || null
    const currentTesting = currentBatch ? testingByBatch.get(currentBatch.batch_number) : null

    const skuTestingRecords = sorted
      .map((b) => testingByBatch.get(b.batch_number))
      .filter(Boolean)
      .sort((a, b) => (b.date_results_received || '').localeCompare(a.date_results_received || ''))
    const lastTestedRecord = skuTestingRecords.find((t) => t.date_results_received) || null

    const inFlight = sorted.filter((b) => NEXT_BATCH_PRIORITY.includes(b.status))
    let nextBatch = null
    let nextStatus = null
    for (const stage of NEXT_BATCH_PRIORITY) {
      const found = inFlight.find((b) => b.status === stage)
      if (found) {
        nextBatch = found
        nextStatus = stage
        break
      }
    }

    let notes = ''
    let noteType = 'info'
    if (nextBatch && (nextStatus === 'approved' || nextStatus === 'in_testing')) {
      notes = `About to swap — next batch ${nextBatch.batch_number} (${STAGE_LABEL[nextStatus]})`
      noteType = 'swap'
    } else if (nextBatch) {
      notes = `Next batch ${nextBatch.batch_number} (${STAGE_LABEL[nextStatus]})`
      noteType = 'in_progress'
    } else if (currentBatch) {
      notes = 'No next batch — order more'
      noteType = 'warning'
    } else {
      notes = 'Not currently on website'
      noteType = 'info'
    }

    rows.push({
      sku,
      compound,
      current_batch: currentBatch?.batch_number || null,
      current_batch_coa_on_file: currentTesting?.coa_on_file === 'yes',
      last_tested: lastTestedRecord?.date_results_received || null,
      last_tested_batch: lastTestedRecord?.batch_number || null,
      last_tested_lab: lastTestedRecord?.lab || null,
      next_batch: nextBatch?.batch_number || null,
      next_batch_status: nextStatus,
      notes,
      note_type: noteType,
    })
  }

  return rows.sort((a, b) => a.sku.localeCompare(b.sku))
}

function buildAllCoaRows({ orders, testing }) {
  const rows = []
  for (const t of testing) {
    if (t.coa_on_file !== 'yes') continue // Only batches with a real COA on file

    const orderInfo = orders.find((o) => o.batch_number === t.batch_number)
    const sku = t.sku || orderInfo?.sku || ''
    const compound = t.compound_mg || orderInfo?.compound_mg || ''

    const daysSinceTested = t.date_results_received
      ? Math.floor((Date.now() - new Date(t.date_results_received + 'T12:00:00').getTime()) / 86400000)
      : null

    rows.push({
      id: t.id,
      batch_number: t.batch_number,
      sku,
      compound,
      lab: t.lab,
      date_tested: t.date_results_received || null,
      pass_fail: t.pass_fail,
      days_since_tested: daysSinceTested,
    })
  }

  // Sort newest COA first
  rows.sort((a, b) => (b.date_tested || '').localeCompare(a.date_tested || ''))
  return rows
}

export function useCoaTracking() {
  const [orders, setOrders] = useState([])
  const [testing, setTesting] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [ordersRes, testingRes] = await Promise.all([
      supabase.from('orders').select('*'),
      supabase.from('testing').select('*'),
    ])
    if (ordersRes.error) setError(ordersRes.error.message)
    else setOrders(ordersRes.data)
    if (testingRes.error) setError(testingRes.error.message)
    else setTesting(testingRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const ordersChannel = supabase
      .channel(`coa-orders-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .subscribe()
    const testingChannel = supabase
      .channel(`coa-testing-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testing' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(testingChannel)
    }
  }, [fetchAll])

  const rows = useMemo(() => buildAuditRows({ orders, testing }), [orders, testing])
  const allCoas = useMemo(() => buildAllCoaRows({ orders, testing }), [orders, testing])

  return { rows, allCoas, loading, error, refetch: fetchAll }
}
