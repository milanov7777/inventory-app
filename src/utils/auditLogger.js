import { supabase } from '../lib/supabase.js'

/**
 * Fire-and-forget audit log insert.
 * Called after every successful mutation (create, update, delete, promote).
 */
export async function logAction({ userName, actionType, batchNumber, stage, changes }) {
  const { error } = await supabase.from('audit_log').insert({
    user_name: userName,
    action_type: actionType,
    batch_number: batchNumber,
    stage,
    changes_json: changes,
  })
  if (error) {
    console.warn('Audit log failed:', error.message)
  }
}
