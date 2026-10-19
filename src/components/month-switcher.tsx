import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useData } from '@/context/data'
import { nombreMes, periodoActual, periodoMas } from '@/lib/format'

export function MonthSwitcher() {
  const { periodo, setPeriodo } = useData()
  const esActual = periodo === periodoActual()
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
      <Button variant="ghost" size="icon-sm" aria-label="Mes anterior" onClick={() => setPeriodo(periodoMas(periodo, -1))}>
        <ChevronLeft />
      </Button>
      <button
        className="min-w-32 px-1 text-center text-sm font-medium"
        title="Ir al mes actual"
        onClick={() => setPeriodo(periodoActual())}
      >
        {nombreMes(periodo)}
        {!esActual && <span className="block text-[10px] leading-none text-muted-foreground">toca para volver a hoy</span>}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Mes siguiente" onClick={() => setPeriodo(periodoMas(periodo, 1))}>
        <ChevronRight />
      </Button>
    </div>
  )
}
