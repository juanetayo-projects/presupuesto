import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { esDemo } from '@/lib/api'

interface AuthState {
  session: Session | null
  loading: boolean
  esMiembro: boolean | null
  recuperando: boolean
  setRecuperando: (v: boolean) => void
  /** Supabase no respondió al validar la sesión. */
  sinConexion: boolean
}

/** Rechaza si la promesa tarda más de `ms` (p. ej. una renovación de sesión que nunca responde). */
function conLimite<T>(p: PromiseLike<T>, ms = 60000) {
  return Promise.race([Promise.resolve(p), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Tiempo de espera agotado')), ms))])
}

const Ctx = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [esMiembro, setEsMiembro] = useState<boolean | null>(null)
  const [recuperando, setRecuperando] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)

  useEffect(() => {
    if (esDemo) {
      setSession({ user: { id: 'demo', email: 'demo@local' } } as Session)
      setEsMiembro(true)
      setLoading(false)
      return
    }
    conLimite(supabase.auth.getSession())
      .then(({ data }) => setSession(data.session))
      .catch(() => setSinConexion(true))
      .finally(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (esDemo) return
    if (!session) {
      setEsMiembro(null)
      return
    }
    conLimite(supabase.rpc('es_miembro'))
      .then(({ data, error }) => {
        // Sin código = la petición no llegó (red o tiempo agotado); con código es una respuesta del servidor
        if (error && !error.code) throw error
        setEsMiembro(Boolean(data))
      })
      .catch(() => setSinConexion(true))
  }, [session?.user.id])

  return (
    <Ctx.Provider value={{ session, loading, esMiembro, recuperando, setRecuperando, sinConexion }}>{children}</Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
