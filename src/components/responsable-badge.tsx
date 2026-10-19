import { Home, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const ESTILOS = [
  'bg-pink-500/12 text-pink-700 ring-pink-500/30 dark:text-pink-300',
  'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  'bg-teal-500/12 text-teal-700 ring-teal-500/30 dark:text-teal-300',
]

/** Pily rosado, Juank azul; "Familiar" neutro. Otros nombres toman un color estable. */
export function estiloResponsable(nombre: string) {
  if (nombre === 'Familiar') return 'bg-muted text-muted-foreground ring-border'
  if (nombre === 'Pily') return ESTILOS[0]
  if (nombre === 'Juank') return ESTILOS[1]
  const h = [...nombre].reduce((s, c) => s + c.charCodeAt(0), 0)
  return ESTILOS[2 + (h % 2)]
}

export function ResponsableBadge({ nombre, className }: { nombre: string | null | undefined; className?: string }) {
  const n = nombre || 'Familiar'
  const Icon = n === 'Familiar' ? Home : User
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium ring-1 ring-inset', estiloResponsable(n), className)}>
      <Icon className="size-3" />
      {n}
    </span>
  )
}
