/**
 * Seed script — populates orders and received tables from CSV files.
 *
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... node scripts/seed.js
 *
 * Or add to your shell environment and just run: npm run seed
 *
 * Uses SUPABASE_SERVICE_KEY (service role) to bypass RLS.
 * NEVER use the service key in browser code.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required.')
  console.error('Example: SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... npm run seed')
  process.exit(1)
}

const supabase = createClient(url, key)

/**
 * Parse a simple CSV file into an array of objects.
 * Handles quoted fields that may contain commas.
 */
function parseCsv(filePath) {
  const text = readFileSync(resolve(filePath), 'utf-8')
  const lines = text.trim().split('\n')
  const headers = parseRow(lines[0])
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseRow(line)
    const obj = {}
    headers.forEach((h, i) => {
      const val = values[i]?.trim() ?? ''
      obj[h.trim()] = val === '' ? null : val
    })
    return obj
  })
}

function parseRow(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current)
  return result
}

async function seed() {
  console.log('Starting seed...\n')

  // --- Orders ---
  let orders = []
  try {
    orders = parseCsv('./orders_seed.csv')
    console.log(`Found ${orders.length} orders in orders_seed.csv`)
  } catch (e) {
    console.warn('orders_seed.csv not found or unreadable — skipping orders seed.')
  }

  if (orders.length > 0) {
    // Coerce numeric fields
    const coerced = orders.map((o) => ({
      ...o,
      qty_ordered: o.qty_ordered ? Number(o.qty_ordered) : null,
      unit_price: o.unit_price ? Number(o.unit_price) : null,
      shipping_cost: o.shipping_cost ? Number(o.shipping_cost) : 0,
    }))

    const { error } = await supabase
      .from('orders')
      .upsert(coerced, { onConflict: 'batch_number' })

    if (error) {
      console.error('Orders seed failed:', error.message)
      process.exit(1)
    }
    console.log(`Seeded ${coerced.length} orders.`)
  }

  // --- Received ---
  let received = []
  try {
    received = parseCsv('./received_seed.csv')
    console.log(`Found ${received.length} received entries in received_seed.csv`)
  } catch (e) {
    console.warn('received_seed.csv not found or unreadable — skipping received seed.')
  }

  if (received.length > 0) {
    const coerced = received.map((r) => ({
      ...r,
      qty_received: r.qty_received ? Number(r.qty_received) : null,
    }))

    const { error } = await supabase
      .from('received')
      .upsert(coerced, { onConflict: 'id' })

    if (error) {
      console.error('Received seed failed:', error.message)
      process.exit(1)
    }
    console.log(`Seeded ${coerced.length} received entries.`)
  }

  console.log('\nSeed complete.')
}

seed()
