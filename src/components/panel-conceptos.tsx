import { ListTree } from 'lucide-react'
import { money, pctLabel } from '@/lib/format'
import { urgencia, valorGasto } from '@/lib/metrics'
import type { Categoria, Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Grupo {
  c: Categoria
  items: Gasto[]
  total: number
}

interface Props {
  grupos: Grupo[]
  totalMes: number
  diasAlerta: number
  onIrCategoria: (id: string) => void
  onAbrir: (g: Gasto) => void
}

/** Índice lateral: cada categoría con sus conceptos, valor y estado; navega a la categoría o abre el gasto. */
export function PanelConceptos({ grupos, totalMes, diasAlerta, onIrCategoria, onAbrir }: Props) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 px-1 text-sm font-semibold">
        <ListTree className="size-4 text-primary" /> Conceptos por categoría
      </p>
      {grupos.length === 0 && <p className="px-1 text-xs text-muted-foreground">Sin gastos con los filtros actuales.</p>}
      {grupos.map(({ c, items, total }) => (
        <div key={c.id} className="overflow-hidden rounded-xl border bg-card">
          <button
            onClick={() => onIrCategoria(c.id)}
            className="flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-xs font-semibold hover:brightness-95"
            style={{ borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 9%, var(--card))` }}
          >
            <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
            <span className="tabular-nums">{money(total)}</span>
            <span className="w-10 text-right font-normal text-muted-foreground tabular-nums">{pctLabel(total, totalMes, 0)}</span>
          </button>
          <ul className="divide-y text-xs">
            {items.map((g) => {
              const u = urgencia(g, diasAlerta)
              return (
                <li key={g.id}>
                  <button onClick={() => onAbrir(g)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/60">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        g.estado === 'pagado' ? 'bg-emerald-500' : u === 'vencido' ? 'bg-rose-500' : u === 'hoy' || u === 'pronto' ? 'bg-amber-500' : 'bg-muted-foreground/40',
                      )}
                      title={g.estado === 'pagado' ? 'Pagado' : u === 'vencido' ? 'Vencido' : 'Pendiente'}
                    />
                    <span className={cn('min-w-0 flex-1 truncate', g.estado === 'pagado' && 'text-muted-foreground line-through')}>{g.descripcion}</span>
                    <span className="tabular-nums">{money(valorGasto(g))}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
