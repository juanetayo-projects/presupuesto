import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'good' | 'bad' | 'warn' | 'brand'

interface Props {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: Tone
  progress?: number
  /** Fondo sólido de color (la métrica principal de la vista). Si no, fondo tintado. */
  solid?: boolean
  onClick?: () => void
}

const tinted: Record<Tone, { card: string; icon: string; bar: string; value: string }> = {
  brand: {
    card: 'border-blue-500/30 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-card',
    icon: 'bg-blue-600 text-white shadow-blue-600/30',
    bar: 'bg-blue-600',
    value: 'text-blue-700 dark:text-blue-300',
  },
  good: {
    card: 'border-emerald-500/30 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-card',
    icon: 'bg-emerald-600 text-white shadow-emerald-600/30',
    bar: 'bg-emerald-500',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  bad: {
    card: 'border-rose-500/30 bg-linear-to-br from-rose-500/15 via-rose-500/5 to-card',
    icon: 'bg-rose-600 text-white shadow-rose-600/30',
    bar: 'bg-rose-500',
    value: 'text-rose-700 dark:text-rose-300',
  },
  warn: {
    card: 'border-amber-500/35 bg-linear-to-br from-amber-500/20 via-amber-500/5 to-card',
    icon: 'bg-amber-500 text-white shadow-amber-500/30',
    bar: 'bg-amber-500',
    value: 'text-amber-700 dark:text-amber-300',
  },
  default: {
    card: 'border-violet-500/30 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-card',
    icon: 'bg-violet-600 text-white shadow-violet-600/30',
    bar: 'bg-violet-500',
    value: 'text-violet-700 dark:text-violet-300',
  },
}

const solidos: Record<Tone, string> = {
  brand: 'from-blue-600 to-indigo-700 shadow-blue-600/25',
  good: 'from-emerald-500 to-teal-700 shadow-emerald-600/25',
  bad: 'from-rose-500 to-red-700 shadow-rose-600/25',
  warn: 'from-amber-500 to-orange-600 shadow-amber-600/25',
  default: 'from-violet-600 to-indigo-700 shadow-violet-600/25',
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'default', progress, solid, onClick }: Props) {
  const t = tinted[tone]
  return (
    <Card
      onClick={onClick}
      className={cn(
        'relative gap-0 overflow-hidden p-4 shadow-sm',
        solid ? cn('border-transparent bg-linear-to-br text-white shadow-lg', solidos[tone]) : t.card,
        onClick && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      {solid && <div className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10" />}
      <div className="relative flex items-start justify-between gap-2">
        <p className={cn('text-xs font-medium', solid ? 'text-white/85' : 'text-muted-foreground')}>{label}</p>
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl shadow-md', solid ? 'bg-white/20 text-white shadow-none' : t.icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn('relative mt-1 truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl', solid ? 'text-white' : t.value)}>{value}</p>
      {progress !== undefined && (
        <div className={cn('relative mt-2 h-1.5 overflow-hidden rounded-full', solid ? 'bg-white/25' : 'bg-foreground/10')}>
          <div className={cn('h-full rounded-full transition-all', solid ? 'bg-white' : t.bar)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <p className={cn('relative mt-1.5 truncate text-[11px]', solid ? 'text-white/80' : 'text-muted-foreground')}>{hint}</p>}
    </Card>
  )
}
