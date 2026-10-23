import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

function intento(input: RequestInfo | URL, init: RequestInit | undefined, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError')), ms)
  init?.signal?.addEventListener('abort', () => ctrl.abort(init.signal?.reason))
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

/** Peticiones que se pueden repetir sin efectos dobles: lecturas, renovar la sesión y verificar si es miembro. */
function repetible(input: RequestInfo | URL, init?: RequestInit) {
  const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const u = String(input instanceof Request ? input.url : input)
  return metodo === 'GET' || metodo === 'HEAD' || u.includes('/auth/v1/token?grant_type=refresh_token') || u.includes('/rest/v1/rpc/es_miembro')
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Si Supabase se cuelga (como en su incidente del 22-23 oct), ninguna petición espera para siempre:
 * las repetibles se reintentan hasta 4 veces con 12 s por intento; las demás (guardar, pagar) esperan 25 s una sola vez.
 */
const fetchConLimite: typeof fetch = async (input, init) => {
  if (!repetible(input, init)) return intento(input, init, 25000)
  let error: unknown
  for (let k = 0; k < 4; k++) {
    if (init?.signal?.aborted) break
    try {
      const r = await intento(input, init, 12000)
      // 520-526: Cloudflare no pudo hablar con el servidor de Supabase
      if (r.status >= 520 && r.status <= 526 && k < 3) {
        error = new Error(`Supabase respondió ${r.status}`)
      } else {
        return r
      }
    } catch (e) {
      error = e
    }
    await espera(400 * (k + 1))
  }
  throw error
}

// PKCE: los enlaces de correo vuelven con ?code=… y no chocan con el HashRouter.
export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: fetchConLimite },
})
