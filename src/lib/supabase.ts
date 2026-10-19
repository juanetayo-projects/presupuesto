import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

// PKCE: los enlaces de correo vuelven con ?code=… y no chocan con el HashRouter.
export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
