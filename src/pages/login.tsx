import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APP_TITLE } from '@/components/app-shell'
import { useAuth } from '@/context/auth'
import { supabase } from '@/lib/supabase'

type Modo = 'entrar' | 'registro' | 'recuperar'

const redirectTo = () => window.location.origin + window.location.pathname

export function LoginPage() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
        if (error) throw error
        if (!data.session) toast.success('Cuenta creada', { description: 'Revisa tu correo para confirmarla y luego ingresa.' })
        setModo('entrar')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
        if (error) throw error
        toast.success('Te enviamos un enlace para restablecer la contraseña')
        setModo('entrar')
      }
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : msg)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Fondo>
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Wallet className="size-6" />
          </div>
          <CardTitle className="text-lg">{APP_TITLE}</CardTitle>
          <CardDescription>
            {modo === 'entrar' ? 'Ingresa para ver el presupuesto del hogar' : modo === 'registro' ? 'Crea tu cuenta con el correo autorizado' : 'Recupera tu contraseña'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {modo !== 'recuperar' && (
              <div className="grid gap-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando && <Loader2 className="animate-spin" />}
              {modo === 'entrar' ? 'Ingresar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-xs">
            {modo === 'entrar' ? (
              <>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setModo('recuperar')}>
                  ¿Olvidaste tu contraseña?
                </button>
                <button className="font-medium text-primary" onClick={() => setModo('registro')}>
                  Crear cuenta
                </button>
              </>
            ) : (
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setModo('entrar')}>
                ← Volver a ingresar
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Fondo>
  )
}

export function NuevaClavePage() {
  const { setRecuperando } = useAuth()
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (error) return toast.error(error.message)
    toast.success('Contraseña actualizada')
    setRecuperando(false)
  }
  return (
    <Fondo>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nueva contraseña</CardTitle>
          <CardDescription>Escribe tu nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="grid gap-4">
            <Input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" disabled={cargando}>
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>
    </Fondo>
  )
}

export function NoAutorizadoPage() {
  const { session } = useAuth()
  return (
    <Fondo>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Cuenta sin acceso</CardTitle>
          <CardDescription>
            {session?.user.email} todavía no es miembro de la familia. Pide que te agreguen en Ajustes → Familia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </Fondo>
  )
}

export function SinConexionPage() {
  return (
    <Fondo>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>No hay respuesta del servidor</CardTitle>
          <CardDescription>
            Supabase (donde viven los datos) no respondió a tiempo. Revisa tu conexión a internet e intenta de nuevo en unos minutos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </CardContent>
      </Card>
    </Fondo>
  )
}

function Fondo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  )
}
