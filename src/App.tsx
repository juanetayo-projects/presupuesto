import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/app-shell'
import { AuthProvider, useAuth } from '@/context/auth'
import { DataProvider } from '@/context/data'
import { UiProvider } from '@/context/ui'
import { AjustesPage } from '@/pages/ajustes'
import { DashboardPage } from '@/pages/dashboard'
import { DeudasPage } from '@/pages/deudas'
import { GastosPage } from '@/pages/gastos'
import { HistoricoPage } from '@/pages/historico'
import { LoginPage, NoAutorizadoPage, NuevaClavePage } from '@/pages/login'

function Rutas() {
  const { session, loading, esMiembro, recuperando } = useAuth()

  if (loading || (session && esMiembro === null)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (recuperando) return <NuevaClavePage />
  if (!session) return <LoginPage />
  if (!esMiembro) return <NoAutorizadoPage />

  return (
    <DataProvider>
      <UiProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="gastos" element={<GastosPage />} />
              <Route path="historico" element={<HistoricoPage />} />
              <Route path="deudas" element={<DeudasPage />} />
              <Route path="ajustes" element={<AjustesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </UiProvider>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <Rutas />
      </AuthProvider>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  )
}
