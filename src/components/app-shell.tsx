import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { CalendarRange, Home, Landmark, ListChecks, LogOut, Moon, Plus, Settings, Sun, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MonthSwitcher } from '@/components/month-switcher'
import { useAuth } from '@/context/auth'
import { useUi } from '@/context/ui'
import { useAlertasNavegador } from '@/hooks/use-alertas'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export const APP_TITLE = 'Presupuesto familia Etayo-Murillo'

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/gastos', label: 'Gastos', icon: ListChecks },
  { to: '/historico', label: 'Histórico', icon: CalendarRange },
  { to: '/deudas', label: 'Deudas', icon: Landmark },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function AppShell() {
  const { session } = useAuth()
  const { abrirGasto } = useUi()
  const { resolvedTheme, setTheme } = useTheme()
  const { vencidos } = useAlertasNavegador()
  const email = session?.user.email ?? ''

  return (
    <div className="min-h-dvh bg-background">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Wallet className="size-4.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Presupuesto</p>
            <p className="text-xs text-sidebar-foreground/65">Familia Etayo-Murillo</p>
          </div>
        </div>
        <nav className="grid gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border',
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
              {n.to === '/gastos' && vencidos > 0 && (
                <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{vencidos}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <Button className="mt-6 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" onClick={() => abrirGasto()}>
          <Plus /> Nuevo gasto
        </Button>
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Wallet className="size-4" />
              </span>
              <p className="truncate text-sm font-semibold">Familia Etayo-Murillo</p>
            </div>
            <h1 className="hidden text-base font-semibold md:block">{APP_TITLE}</h1>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="hidden sm:block">
                <MonthSwitcher />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              >
                {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Cuenta">
                    <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">
                      {email.slice(0, 2)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                    {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
                    {resolvedTheme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => supabase.auth.signOut()}>
                    <LogOut /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex justify-center px-4 pb-2 sm:hidden">
            <MonthSwitcher />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        <div className="relative mx-auto grid h-16 max-w-md grid-cols-6 items-center">
          {NAV.slice(0, 2).map((n) => (
            <BottomItem key={n.to} {...n} badge={n.to === '/gastos' ? vencidos : 0} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => abrirGasto()}
              aria-label="Nuevo gasto"
              className="-mt-7 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 shadow-primary/30 ring-background transition active:scale-95"
            >
              <Plus className="size-6" />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <BottomItem key={n.to} {...n} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function BottomItem({ to, label, icon: Icon, end, badge = 0 }: (typeof NAV)[number] & { badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('relative flex flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground', isActive && 'text-primary')
      }
    >
      <Icon className="size-5" />
      {label}
      {badge > 0 && (
        <span className="absolute -top-1 right-[calc(50%-18px)] min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] leading-4 font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  )
}
