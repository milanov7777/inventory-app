/**
 * Push schema to Supabase using the Management API.
 * Usage: node scripts/push_schema.js
 *
 * Requires SUPABASE_SERVICE_KEY in .env or environment.
 * Uses the Supabase SQL execution endpoint.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

const schema = readFileSync('./schema.sql', 'utf-8')

// Split schema into individual statements and run them sequentially
const statements = schema
  .replace(/--[^\n]*/g, '')  // strip comments
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

async function run() {
  console.log(`Running ${statements.length} statements...\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ')

    const { data, error } = await supabase.rpc('', undefined)
      .then(() => ({ data: null, error: null }))
      .catch(() => ({ data: null, error: null }))

    // Use raw SQL via the PostgREST rpc approach won't work for DDL.
    // Instead use fetch directly against the SQL endpoint
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      }
    })
  }
}

// Actually the right approach: use the pg-meta SQL endpoint
async function pushSchema() {
  const sql = readFileSync('./schema.sql', 'utf-8')

  // The Supabase project's pg-meta endpoint for running SQL
  const res = await fetch(`${url.replace('.supabase.co', '.supabase.co')}/pg/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql })
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`HTTP ${res.status}: ${text}`)

    // Fallback: try individual statements via supabase.rpc
    console.log('\nTrying individual statements via raw SQL function...')
    await runIndividual(sql)
    return
  }

  const data = await res.json()
  console.log('Schema pushed successfully:', data)
}

async function runIndividual(sql) {
  // We'll create a function that can execute arbitrary SQL, then use it
  const supabase = createClient(url, key)

  // First, try to create an exec_sql function
  const createFn = `
    create or replace function exec_sql(query text) returns void as $$
    begin
      execute query;
    end;
    $$ language plpgsql security definer;
  `

  const { error: fnErr } = await supabase.rpc('exec_sql', { query: createFn })

  if (fnErr) {
    // Function doesn't exist yet, but we can't create it without running SQL
    console.error('Cannot run DDL via REST API. Please run schema.sql in the Supabase SQL Editor.')
    console.error('Go to: https://supabase.com/dashboard/project/uxjgqwaeruustwnxplyy/sql/new')
    process.exit(1)
  }

  // If function exists, run the schema through it
  const stmts = sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of stmts) {
    const { error } = await supabase.rpc('exec_sql', { query: stmt })
    if (error) {
      console.error(`Failed: ${stmt.substring(0, 60)}...`)
      console.error(error.message)
    } else {
      console.log(`OK: ${stmt.substring(0, 60)}...`)
    }
  }
}

pushSchema()
