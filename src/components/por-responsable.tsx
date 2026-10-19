import { Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsableBadge } from '@/components/responsable-badge'
import { money, pct } from '@/lib/format'
import { valorGasto } from '@/lib/metrics'
import type { Gasto } from '@/lib/types'

/** Reparto del gasto del mes entre gasto familiar y gastos personales (Pily, Juank…). */
export function PorResponsable({ gastos, responsables }: { gastos: Gasto[]; responsables: string[] }) {
  const activos = gastos.filter((g) => g.estado !== 'omitido')
  const total = activos.reduce((s, g) => s + valorGasto(g), 0)
  const filas = responsables
    .map((r) => ({ r, valor: activos.filter((g) => (g.responsable || 'Familiar') === r).reduce((s, g) => s + valorGasto(g), 0) }))
    .sort((a, b) => b.valor - a.valor)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary" /> ¿De quién es el gasto?
        </CardTitle>
        <CardDescription>Familiar frente a personales, % del total de gastos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {filas.map(({ r, valor }) => (
          <div key={r}>
            <div className="flex items-center gap-2 text-sm">
              <ResponsableBadge nombre={r} />
              <span className="ml-auto tabular-nums">{money(valor)}</span>
              <span className="w-12 text-right font-semibold tabular-nums">{pct(valor, total).toFixed(1)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct(valor, total)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
