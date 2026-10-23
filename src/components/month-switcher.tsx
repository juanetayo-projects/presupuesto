import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useData } from '@/context/data'
import { nombreMes, periodoActual, periodoMas } from '@/lib/format'
import { ETIQUETA_MES } from '@/lib/metrics'
import { cn } from '@/lib/utils'

const TONO = {
  cerrado: 'text-slate-500 dark:text-slate-400',
  pasado: 'text-amber-600 dark:text-amber-400',
  actual: 'text-emerald-600 dark:text-emerald-400',
  futuro: 'text-violet-600 dark:text-violet-300',
}

export function MonthSwitcher() {
  const { periodo, setPeriodo, estadoMes } = useData()
  const esActual = periodo === periodoActual()
  const estado = estadoMes(periodo)
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
      <Button variant="ghost" size="icon-sm" aria-label="Mes anterior" onClick={() => setPeriodo(periodoMas(periodo, -1))}>
        <ChevronLeft />
      </Button>
      <button className="min-w-32 px-1 text-center text-sm font-medium" title={esActual ? 'Mes actual' : 'Ir al mes actual'} onClick={() => setPeriodo(periodoActual())}>
        <span key={periodo} className="reveal block">
          {nombreMes(periodo)}
        </span>
        <span className={cn('flex items-center justify-center gap-1 text-[10px] leading-none font-medium', TONO[estado])}>
          {estado === 'cerrado' && <Lock className="size-2.5" />}
          {ETIQUETA_MES[estado]}
          {!esActual && <span className="font-normal text-muted-foreground">· volver a hoy</span>}
        </span>
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Mes siguiente" onClick={() => setPeriodo(periodoMas(periodo, 1))}>
        <ChevronRight />
      </Button>
    </div>
  )
}
