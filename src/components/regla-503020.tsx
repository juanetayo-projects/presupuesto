import { Scale } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { money, pct } from '@/lib/format'
import { valorGasto } from '@/lib/metrics'
import { CLASES, type Categoria, type ClaseCategoria, type Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONO: Record<ClaseCategoria, string> = { necesidad: '#2a78d6', deseo: '#eda100', ahorro_deuda: '#1baf7a' }

/**
 * Regla 50/30/20 (YNAB, Monarch, Fintonic): compara el reparto real del ingreso
 * contra la guía 50% necesidades · 30% gustos · 20% ahorro y deudas.
 * La clase de cada categoría se cambia en Ajustes → Categorías.
 */
export function Regla503020({ gastos, ingreso, catPorId }: { gastos: Gasto[]; ingreso: number; catPorId: Map<string, Categoria> }) {
  const sumas: Record<ClaseCategoria, number> = { necesidad: 0, deseo: 0, ahorro_deuda: 0 }
  for (const g of gastos) {
    if (g.estado === 'omitido') continue
    const clase = catPorId.get(g.categoria_id)?.clase ?? 'necesidad'
    sumas[clase] += valorGasto(g)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4 text-primary" /> Regla 50/30/20
        </CardTitle>
        <CardDescription>Reparto del ingreso frente a la guía recomendada</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(CLASES) as ClaseCategoria[]).map((k) => {
          const real = pct(sumas[k], ingreso)
          const meta = CLASES[k].meta
          // ahorro_deuda: la guía es un mínimo deseable; necesidades y gustos, un máximo
          const fuera = k === 'ahorro_deuda' ? false : real > meta + 2
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{CLASES[k].label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {money(sumas[k])} · <b className={cn('text-foreground', fuera && 'text-rose-600 dark:text-rose-400')}>{real.toFixed(1)}%</b> / {meta}%
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, real)}%`, background: TONO[k] }} />
                <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${meta}%` }} title={`Guía ${meta}%`} />
              </div>
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground">
          La línea vertical marca la guía. Disponible sin asignar: {money(ingreso - sumas.necesidad - sumas.deseo - sumas.ahorro_deuda)}.
        </p>
      </CardContent>
    </Card>
  )
}
