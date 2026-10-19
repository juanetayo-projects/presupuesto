import { useMemo, useState } from 'react'
import { eachDayOfInterval, endOfMonth, format, getDay, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { IconoGasto } from '@/components/marca-icono'
import { money, moneyShort } from '@/lib/format'
import { urgencia } from '@/lib/metrics'
import type { Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Vista calendario de vencimientos (estilo Mobills / Wallet). Toca un día para ver sus pagos. */
export function CalendarioPagos({ periodo, gastos, diasAlerta, onSelect }: { periodo: string; gastos: Gasto[]; diasAlerta: number; onSelect: (g: Gasto) => void }) {
  const [dia, setDia] = useState<string | null>(null)
  const inicio = parseISO(periodo)
  const dias = eachDayOfInterval({ start: inicio, end: endOfMonth(inicio) })
  const offset = (getDay(inicio) + 6) % 7 // lunes primero

  const porDia = useMemo(() => {
    const m = new Map<string, Gasto[]>()
    for (const g of gastos) {
      if (!g.fecha_limite || g.estado === 'omitido') continue
      m.set(g.fecha_limite, [...(m.get(g.fecha_limite) ?? []), g])
    }
    return m
  }, [gastos])
  const sinFecha = gastos.filter((g) => !g.fecha_limite && g.estado !== 'omitido')
  const seleccion = dia ? porDia.get(dia) ?? [] : []

  return (
    <div className="space-y-3">
      <Card className="gap-0 p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium text-muted-foreground">
          {DIAS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`v${i}`} />
          ))}
          {dias.map((d) => {
            const iso = format(d, 'yyyy-MM-dd')
            const items = porDia.get(iso) ?? []
            const total = items.reduce((s, g) => s + Number(g.valor_presupuestado), 0)
            const pendientes = items.filter((g) => g.estado === 'pendiente')
            const vencido = pendientes.some((g) => urgencia(g, diasAlerta) === 'vencido')
            const todoPagado = items.length > 0 && pendientes.length === 0
            return (
              <button
                key={iso}
                onClick={() => setDia(dia === iso ? null : iso)}
                className={cn(
                  'flex aspect-square min-h-11 flex-col items-center justify-start gap-0.5 rounded-lg border border-transparent p-1 text-xs transition sm:aspect-auto sm:h-16',
                  items.length && 'bg-muted/60',
                  dia === iso && 'border-primary bg-primary/10',
                  isToday(d) && 'ring-2 ring-primary/50',
                )}
              >
                <span className={cn('font-medium', isToday(d) && 'text-primary')}>{format(d, 'd')}</span>
                {items.length > 0 && (
                  <>
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        vencido ? 'bg-rose-500' : todoPagado ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    <span className="hidden text-[10px] text-muted-foreground tabular-nums sm:block">{moneyShort(total)}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 px-1 text-[11px] text-muted-foreground">
          <Leyenda color="bg-rose-500" label="Vencido" />
          <Leyenda color="bg-amber-500" label="Pendiente" />
          <Leyenda color="bg-emerald-500" label="Pagado" />
        </div>
      </Card>

      {dia && (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          <p className="bg-muted/40 px-4 py-2 text-xs font-medium capitalize">{format(parseISO(dia), "EEEE d 'de' MMMM", { locale: es })}</p>
          {seleccion.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Sin pagos este día.</p>}
          {seleccion.map((g) => (
            <button key={g.id} onClick={() => onSelect(g)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/50">
              <span className={cn('size-2 rounded-full', g.estado === 'pagado' ? 'bg-emerald-500' : urgencia(g, diasAlerta) === 'vencido' ? 'bg-rose-500' : 'bg-amber-500')} />
              <IconoGasto g={g} size="sm" />
              <span className="flex-1 truncate">{g.descripcion}</span>
              <span className="font-medium tabular-nums">{money(g.valor_presupuestado)}</span>
            </button>
          ))}
        </Card>
      )}
      {sinFecha.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {sinFecha.length} gasto(s) sin fecha límite: {sinFecha.map((g) => g.descripcion).join(', ')}.
        </p>
      )}
    </div>
  )
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-full', color)} /> {label}
    </span>
  )
}
