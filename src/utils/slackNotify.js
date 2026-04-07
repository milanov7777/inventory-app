import { supabase } from '../lib/supabase.js'

/**
 * Fire-and-forget Slack notification via the slack-warehouse Edge Function.
 * Never throws — Slack failures must not block the main app flow.
 */
export async function notifySlack(event, data) {
  try {
    const { error } = await supabase.functions.invoke('slack-warehouse', {
      body: { event, data },
    })
    if (error) console.warn('Slack notification failed:', error.message)
  } catch (err) {
    console.warn('Slack notification error:', err)
  }
}
