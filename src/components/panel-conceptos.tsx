import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from '@/components/category-icon'
import { IconoGasto } from '@/components/marca-icono'
import { ResponsableBadge } from '@/components/responsable-badge'
import { fechaCorta, money, pct, pctLabel } from '@/lib/format'
import { urgencia, valorGasto } from '@/lib/metrics'
import type { Categoria, Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  c: Categoria
  items: Gasto[]
  total: number
  totalMes: number
  diasAlerta: number
  onCerrar: () => void
  onAbrir: (g: Gasto) => void
}

/** Detalle de la categoría seleccionada: sus conceptos con valor, % dentro de la categoría y estado. */
export function PanelConceptos({ c, items, total, totalMes, diasAlerta, onCerrar, onAbrir }: Props) {
  const pagado = items.filter((g) => g.estado === 'pagado').reduce((s, g) => s + valorGasto(g), 0)
  const ordenados = [...items].sort((a, b) => valorGasto(b) - valorGasto(a))
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-l-4 px-3 py-3" style={{ borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 10%, var(--card))` }}>
        <div className="flex items-center gap-2">
          <CategoryIcon icono={c.icono} color={c.color} size="sm" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c.nombre}</p>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar panel" onClick={onCerrar}>
            <X />
          </Button>
        </div>
        <div className="mt-2 flex items-baseline justify-between text-xs">
          <span className="text-lg font-semibold tabular-nums">{money(total)}</span>
          <span className="text-muted-foreground">{pctLabel(total, totalMes)} del total del mes</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full" style={{ width: `${pct(pagado, total)}%`, background: c.color }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          Pagado {money(pagado)} · pendiente {money(total - pagado)}
        </p>
      </div>
      <ul className="divide-y">
        {ordenados.map((g) => {
          const u = urgencia(g, diasAlerta)
          const v = valorGasto(g)
          return (
            <li key={g.id}>
              <button onClick={() => onAbrir(g)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60">
                <IconoGasto g={g} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-xs font-medium', g.estado === 'pagado' && 'text-muted-foreground line-through')}>{g.descripcion}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {g.responsable && g.responsable !== 'Familiar' && <ResponsableBadge nombre={g.responsable} className="h-4 px-1 text-[9px]" />}
                    <span
                      className={cn(
                        g.estado === 'pagado' ? 'text-emerald-600 dark:text-emerald-400' : u === 'vencido' ? 'text-rose-600 dark:text-rose-400' : u === 'hoy' || u === 'pronto' ? 'text-amber-600 dark:text-amber-400' : '',
                      )}
                    >
                      {g.estado === 'pagado' ? 'Pagado' : u === 'vencido' ? 'Vencido' : g.fecha_limite ? `Vence ${fechaCorta(g.fecha_limite)}` : 'Sin fecha'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums">{money(v)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{pctLabel(v, total, 0)}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
