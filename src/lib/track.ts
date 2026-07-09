import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export function trackEvent(event_name: string, metadata?: Record<string, unknown>) {
  const supabase = getSupabase()
  if (!supabase) return
  supabase.from('events').insert({
    event_name,
    source_app: 'ide',
    path: window.location.pathname,
    metadata: metadata ?? null,
  }).then(() => {})
}
