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
}

const Ctx = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [esMiembro, setEsMiembro] = useState<boolean | null>(null)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    if (esDemo) {
      setSession({ user: { id: 'demo', email: 'demo@local' } } as Session)
      setEsMiembro(true)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
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
    supabase.rpc('es_miembro').then(({ data }) => setEsMiembro(Boolean(data)))
  }, [session?.user.id])

  return (
    <Ctx.Provider value={{ session, loading, esMiembro, recuperando, setRecuperando }}>{children}</Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
