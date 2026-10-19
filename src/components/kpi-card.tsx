import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'default' | 'good' | 'bad' | 'warn' | 'brand'
  progress?: number
}

const tones = {
  default: 'text-muted-foreground bg-muted',
  brand: 'text-primary bg-primary/10',
  good: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
  bad: 'text-rose-600 bg-rose-500/10 dark:text-rose-400',
  warn: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
}
const bars = {
  default: 'bg-foreground/40',
  brand: 'bg-primary',
  good: 'bg-emerald-500',
  bad: 'bg-rose-500',
  warn: 'bg-amber-500',
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'default', progress }: Props) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl">{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', bars[tone])} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  )
}
