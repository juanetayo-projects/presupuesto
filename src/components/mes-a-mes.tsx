import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { mesCorto, money, moneyShort, periodoMas } from '@/lib/format'
import { valorGasto } from '@/lib/metrics'
import type { Categoria, Gasto } from '@/lib/types'

interface Props {
  periodo: string
  gastos: Gasto[] // ya filtrados por los filtros de la página (todos los meses)
  categorias: Categoria[]
}

/**
 * Gastos mes a mes. "Categoría": barras apiladas por categoría (color = categoría).
 * "Concepto": un solo concepto elegido, barra por mes con su valor y % del total del mes.
 */
export function MesAMes({ periodo, gastos, categorias }: Props) {
  const [modo, setModo] = useState<'categoria' | 'concepto'>('categoria')
  const [meses, setMeses] = useState('6')
  const conceptos = useMemo(() => [...new Set(gastos.map((g) => g.descripcion))].sort((a, b) => a.localeCompare(b)), [gastos])
  const [concepto, setConcepto] = useState('')
  const elegido = concepto && conceptos.includes(concepto) ? concepto : conceptos[0] ?? ''

  // La ventana termina en el mes elegido o en el último mes con datos (p. ej. meses ya proyectados), el que sea mayor.
  const fin = useMemo(() => gastos.reduce((m, g) => (g.periodo > m ? g.periodo : m), periodo), [gastos, periodo])
  const periodos = useMemo(() => Array.from({ length: Number(meses) }, (_, i) => periodoMas(fin, i - Number(meses) + 1)), [fin, meses])

  const { filas, series } = useMemo(() => {
    const activos = gastos.filter((g) => g.estado !== 'omitido')
    const usadas = categorias.filter((c) => activos.some((g) => g.categoria_id === c.id && periodos.includes(g.periodo)))
    const filas = periodos.map((p) => {
      const delMes = activos.filter((g) => g.periodo === p)
      const total = delMes.reduce((s, g) => s + valorGasto(g), 0)
      const fila: Record<string, number | string> = { mes: mesCorto(p), total }
      if (modo === 'categoria') {
        for (const c of usadas) fila[c.id] = delMes.filter((g) => g.categoria_id === c.id).reduce((s, g) => s + valorGasto(g), 0)
      } else {
        const v = delMes.filter((g) => g.descripcion === elegido).reduce((s, g) => s + valorGasto(g), 0)
        fila.valor = v
        fila.pct = total ? (v / total) * 100 : 0
      }
      return fila
    })
    return { filas, series: usadas }
  }, [gastos, categorias, periodos, modo, elegido])

  const config: ChartConfig =
    modo === 'categoria'
      ? Object.fromEntries(series.map((c) => [c.id, { label: c.nombre, color: c.color }]))
      : { valor: { label: elegido, color: '#2a78d6' } }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" /> Gastos mes a mes
        </CardTitle>
        <CardDescription>
          {modo === 'categoria' ? 'Total de cada mes, apilado por categoría' : `Valor de “${elegido}” por mes y su % del total de gastos del mes`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={modo} onValueChange={(v) => v && setModo(v as 'categoria' | 'concepto')}>
            <ToggleGroupItem value="categoria" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Por categoría
            </ToggleGroupItem>
            <ToggleGroupItem value="concepto" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Por concepto
            </ToggleGroupItem>
          </ToggleGroup>
          {modo === 'concepto' && (
            <Select value={elegido} onValueChange={setConcepto}>
              <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                <SelectValue placeholder="Concepto" />
              </SelectTrigger>
              <SelectContent>
                {conceptos.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={meses} onValueChange={setMeses}>
            <SelectTrigger size="sm" className="w-28" aria-label="Rango de meses">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={filas} margin={{ left: 0, right: 8, top: 20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => moneyShort(Number(v))} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const fila = payload[0].payload as Record<string, number>
                return (
                  <div className="grid min-w-48 gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium capitalize">{label}</p>
                    {modo === 'categoria' ? (
                      <>
                        {[...series]
                          .filter((c) => fila[c.id])
                          .sort((a, b) => fila[b.id] - fila[a.id])
                          .map((c) => (
                            <div key={c.id} className="flex items-center gap-2">
                              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                              <span className="truncate text-muted-foreground">{c.nombre}</span>
                              <span className="ml-auto pl-2 font-medium tabular-nums">{money(fila[c.id])}</span>
                              <span className="w-11 text-right text-muted-foreground tabular-nums">{((fila[c.id] / fila.total) * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        <div className="mt-1 flex border-t pt-1 font-medium">
                          Total <span className="ml-auto tabular-nums">{money(fila.total)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="tabular-nums">{money(fila.valor)}</p>
                        <p className="text-muted-foreground">
                          {fila.pct.toFixed(1)}% de {money(fila.total)} gastados en el mes
                        </p>
                      </>
                    )}
                  </div>
                )
              }}
            />
            {modo === 'categoria' ? (
              series.map((c, i) => (
                <Bar
                  key={c.id}
                  dataKey={c.id}
                  stackId="a"
                  fill={c.color}
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={44}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                >
                  {i === series.length - 1 && (
                    <LabelList dataKey="total" position="top" className="fill-foreground text-[10px] tabular-nums" formatter={(v) => (Number(v) ? moneyShort(Number(v)) : '')} />
                  )}
                </Bar>
              ))
            ) : (
              <Bar dataKey="valor" fill="var(--color-valor)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="pct" position="top" className="fill-foreground text-[10px] tabular-nums" formatter={(v) => (Number(v) ? `${Number(v).toFixed(1)}%` : '')} />
              </Bar>
            )}
          </BarChart>
        </ChartContainer>

        {modo === 'categoria' && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {series.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: c.color }} />
                {c.nombre}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
