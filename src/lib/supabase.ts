import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

/** Ninguna petición espera más de 20 s: si Supabase no responde, la app muestra un aviso en vez de quedarse cargando. */
const fetchConLimite: typeof fetch = (input, init) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError')), 20000)
  init?.signal?.addEventListener('abort', () => ctrl.abort(init.signal?.reason))
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// PKCE: los enlaces de correo vuelven con ?code=… y no chocan con el HashRouter.
export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: fetchConLimite },
})
