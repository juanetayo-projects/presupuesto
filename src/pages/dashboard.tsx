import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownRight, Copy, Download, BellRing, CalendarClock, CheckCircle2, CircleDollarSign, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { FilterBar } from '@/components/filter-bar'
import { IngresoForm } from '@/components/ingresos'
import { KpiCard } from '@/components/kpi-card'
import { MesAMes } from '@/components/mes-a-mes'
import { MetasResumen } from '@/components/metas'
import { Regla503020 } from '@/components/regla-503020'
import { useData, useFiltros } from '@/context/data'
import { useUi } from '@/context/ui'
import { useAlertasNavegador } from '@/hooks/use-alertas'
import { copiarMesAnterior, generarMes } from '@/lib/api'
import { exportarMesExcel } from '@/lib/export'
import { diasHasta, fechaCorta, mesCorto, money, moneyShort, nombreMes, pct, pctLabel, periodoMas } from '@/lib/format'
import { aplicarFiltros, porCategoria, porConcepto, resumen, valorGasto } from '@/lib/metrics'
import type { Ingreso } from '@/lib/types'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { loading, periodo, gastos, ingresos, categorias, conceptos, obligaciones, config, catPorId, recargar } = useData()
  const [filtros] = useFiltros('inicio')
  const { pagar } = useUi()
  const { alertas } = useAlertasNavegador()
  const [generando, setGenerando] = useState(false)
  const [nuevoIngreso, setNuevoIngreso] = useState<Partial<Ingreso> | null>(null)

  const gastosMes = useMemo(() => gastos.filter((g) => g.periodo === periodo), [gastos, periodo])
  const ingresosMes = useMemo(() => ingresos.filter((i) => i.periodo === periodo), [ingresos, periodo])
  const filtrados = useMemo(() => aplicarFiltros(gastosMes, { ...filtros, texto: '' }, config.diasAlerta), [gastosMes, filtros, config.diasAlerta])
  const r = useMemo(() => resumen(filtrados, ingresosMes), [filtrados, ingresosMes])
  const todosFiltrados = useMemo(() => aplicarFiltros(gastos, { ...filtros, texto: '' }, config.diasAlerta), [gastos, filtros, config.diasAlerta])
  const cats = useMemo(() => porCategoria(filtrados, categorias), [filtrados, categorias])
  const items = useMemo(() => porConcepto(filtrados, catPorId), [filtrados, catPorId])

  const tendencia = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => periodoMas(periodo, i - 5)).map((p) => {
      const gs = aplicarFiltros(gastos.filter((g) => g.periodo === p), { ...filtros, texto: '' }, config.diasAlerta)
      const ing = ingresos.filter((x) => x.periodo === p).reduce((s, x) => s + Number(x.valor), 0)
      const total = gs.filter((g) => g.estado !== 'omitido').reduce((s, g) => s + valorGasto(g), 0)
      return { mes: mesCorto(p), gastos: total, ingreso: ing || null }
    })
  }, [gastos, ingresos, periodo, filtros, config.diasAlerta])

  const deudaTotal = obligaciones.filter((o) => o.tipo !== 'cadena' && o.activo).reduce((s, o) => s + Number(o.saldo_actual ?? 0), 0)
  const sinSaldo = obligaciones.filter((o) => o.tipo !== 'cadena' && o.saldo_inicial == null).length

  async function generar() {
    setGenerando(true)
    try {
      const n = await generarMes(periodo, conceptos, gastosMes, ingresosMes, config.ingresoBase)
      toast.success(n ? `Se crearon ${n} gastos para ${nombreMes(periodo)}` : 'El mes ya tenía todos los conceptos')
      await recargar()
    } catch (e) {
      toast.error('No se pudo generar el mes', { description: (e as Error).message })
    } finally {
      setGenerando(false)
    }
  }

  const anterior = periodoMas(periodo, -1)
  const gastosAnt = gastos.filter((g) => g.periodo === anterior)

  async function copiar() {
    setGenerando(true)
    try {
      const n = await copiarMesAnterior(periodo, gastosAnt, ingresos.filter((i) => i.periodo === anterior), ingresosMes)
      toast.success(`Se copiaron ${n} gastos de ${nombreMes(anterior)}`)
      await recargar()
    } catch (e) {
      toast.error('No se pudo copiar', { description: (e as Error).message })
    } finally {
      setGenerando(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  if (gastosMes.length === 0) {
    return (
      <Card className="mx-auto mt-8 max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarClock className="size-6" />
          </div>
          <CardTitle>{nombreMes(periodo)} aún no tiene presupuesto</CardTitle>
          <CardDescription>
            Se crean los {conceptos.filter((c) => c.activo && c.recurrente).length} gastos recurrentes de la plantilla y el ingreso base de{' '}
            {money(config.ingresoBase)}. Después puedes ajustar valores y agregar otros gastos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Button onClick={generar} disabled={generando} className="w-full">
              {generando ? 'Generando…' : `Generar desde la plantilla`}
            </Button>
            {gastosAnt.length > 0 && (
              <Button variant="outline" onClick={copiar} disabled={generando} className="w-full">
                <Copy /> Copiar valores de {nombreMes(anterior)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const usoIngreso = pct(r.total, r.ingreso)
  const ejecucion = pct(r.pagado, r.presupuestado)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Resumen de {nombreMes(periodo)}</h2>
          <p className="text-sm text-muted-foreground">
            Los porcentajes de las gráficas son respecto del total de gastos del mes ({money(r.total)}).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportarMesExcel(periodo, filtrados, ingresosMes, categorias, obligaciones).catch((e) => toast.error('No se pudo exportar', { description: e.message }))}
        >
          <Download /> <span className="hidden sm:inline">Excel</span>
        </Button>
      </div>

      <FilterBar pagina="inicio" buscar={false} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          solid
          label="Ingreso del mes"
          value={money(r.ingreso)}
          icon={Wallet}
          tone="brand"
          hint={`${ingresosMes.length} ingreso(s) · toca para agregar`}
          onClick={() => setNuevoIngreso({ periodo, tipo: 'Otro', valor: 0 })}
        />
        <KpiCard
          label="Total gastos"
          value={money(r.total)}
          icon={Receipt}
          tone={usoIngreso > 90 ? 'bad' : usoIngreso > 75 ? 'warn' : 'default'}
          progress={usoIngreso}
          hint={`${pctLabel(r.total, r.ingreso)} del ingreso`}
        />
        <KpiCard label="Pagado" value={money(r.pagado)} icon={CheckCircle2} tone="good" progress={ejecucion} hint={`${r.nPagados} de ${r.n} · ${pctLabel(r.pagado, r.presupuestado)} ejecutado`} />
        <KpiCard label="Por pagar" value={money(r.pendiente)} icon={ArrowDownRight} tone="warn" hint={`${r.nPendientes} pago(s) pendiente(s)`} />
        <KpiCard
          solid
          label="Disponible"
          value={money(r.disponible)}
          icon={PiggyBank}
          tone={r.disponible < 0 ? 'bad' : 'good'}
          hint={r.disponible < 0 ? 'Gastos superan el ingreso' : `${pctLabel(r.disponible, r.ingreso)} del ingreso libre`}
        />
        <KpiCard label="Deuda total" value={money(deudaTotal)} icon={Landmark} tone="default" hint={sinSaldo ? `${sinSaldo} obligación(es) sin saldo registrado` : 'Saldo de préstamos y tarjetas'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-primary" /> Alertas de pago
            </CardTitle>
            <CardDescription>Vencidos y próximos {config.diasAlerta} días (todos los meses)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Sin pagos urgentes. ¡Todo al día!
              </div>
            )}
            {alertas.slice(0, 7).map(({ g, u }) => {
              const d = diasHasta(g.fecha_limite!)
              const cat = catPorId.get(g.categoria_id)
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  {cat && <CategoryIcon icono={cat.icono} color={cat.color} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.descripcion}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {money(g.valor_presupuestado)} · {fechaCorta(g.fecha_limite)}
                      </span>
                      <Badge variant={u === 'vencido' ? 'destructive' : 'outline'} className={cn('h-5', u === 'hoy' && 'border-amber-500/50 text-amber-700 dark:text-amber-300')}>
                        {u === 'vencido' && <AlertTriangle />}
                        {u === 'vencido' ? `Vencido ${-d}d` : u === 'hoy' ? 'Hoy' : `En ${d}d`}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => pagar(g)}>
                    Pagar
                  </Button>
                </div>
              )
            })}
            {alertas.length > 7 && (
              <Button asChild variant="link" size="sm" className="px-0">
                <Link to="/gastos">Ver los {alertas.length} pendientes</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Gasto por categoría</CardTitle>
            <CardDescription>Valor y % del total de gastos</CardDescription>
          </CardHeader>
          <CardContent className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <DonutCategorias data={cats} total={r.total} />
            <ul className="min-w-0 space-y-2.5">
              {cats.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                    <span className="tabular-nums text-muted-foreground">{money(c.valor)}</span>
                    <span className="w-12 text-right font-medium tabular-nums">{c.pct.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 ml-4.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consumo por concepto</CardTitle>
            <CardDescription>% respecto del total de gastos · color = categoría</CardDescription>
            <CardAction>
              <Badge variant="secondary">{items.length} conceptos</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <BarrasConcepto data={items} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia 6 meses</CardTitle>
            <CardDescription>Total de gastos (barras) frente al ingreso (línea)</CardDescription>
          </CardHeader>
          <CardContent>
            <Tendencia data={tendencia} />
          </CardContent>
        </Card>
      </div>

      <MesAMes periodo={periodo} gastos={todosFiltrados} categorias={categorias} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Regla503020 gastos={filtrados} ingreso={r.ingreso} catPorId={catPorId} />
        <MetasResumen />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDollarSign className="size-4 text-primary" /> Ejecución por categoría
          </CardTitle>
          <CardDescription>Pagado frente a presupuestado</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categorias
            .map((c) => {
              const gs = filtrados.filter((g) => g.categoria_id === c.id && g.estado !== 'omitido')
              const pres = gs.reduce((s, g) => s + Number(g.valor_presupuestado), 0)
              const pag = gs.filter((g) => g.estado === 'pagado').reduce((s, g) => s + Number(g.valor_pagado ?? 0), 0)
              return { c, pres, pag, n: gs.length }
            })
            .filter((x) => x.n > 0)
            .map(({ c, pres, pag }) => (
              <div key={c.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon icono={c.icono} color={c.color} size="sm" />
                  <p className="truncate text-sm font-medium">{c.nombre}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {money(pag)} de {money(pres)}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct(pag, pres))}%`, background: c.color }} />
                </div>
                <p className="mt-1 text-right text-[11px] font-medium tabular-nums">{pctLabel(pag, pres, 0)}</p>
              </div>
            ))}
        </CardContent>
      </Card>
      <IngresoForm ingreso={nuevoIngreso} onClose={() => setNuevoIngreso(null)} />
    </div>
  )
}

function DonutCategorias({ data, total }: { data: ReturnType<typeof porCategoria>; total: number }) {
  const config = Object.fromEntries(data.map((d) => [d.key, { label: d.nombre, color: d.color }])) satisfies ChartConfig
  return (
    <ChartContainer config={config} className="relative mx-auto aspect-square w-full max-w-[180px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<TooltipPorcion />} />
        <Pie data={data} dataKey="valor" nameKey="nombre" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} cornerRadius={4} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Pie>
        <text x="50%" y="46%" textAnchor="middle" className="fill-muted-foreground text-[10px]">
          Total gastos
        </text>
        <text x="50%" y="58%" textAnchor="middle" className="fill-foreground text-sm font-semibold">
          {moneyShort(total)}
        </text>
      </PieChart>
    </ChartContainer>
  )
}

function BarrasConcepto({ data }: { data: ReturnType<typeof porConcepto> }) {
  const top = data.slice(0, 12)
  const resto = data.slice(12)
  const filas = resto.length
    ? [...top, { key: 'otros', nombre: `Otros (${resto.length})`, valor: resto.reduce((s, x) => s + x.valor, 0), pct: resto.reduce((s, x) => s + x.pct, 0), color: '#94a3b8' }]
    : top
  return (
    <ChartContainer config={{ valor: { label: 'Valor' } }} className="aspect-auto w-full" style={{ height: Math.max(160, filas.length * 30 + 10) }}>
      <BarChart data={filas} layout="vertical" margin={{ left: 0, right: 70, top: 0, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="nombre" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<TooltipPorcion />} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {filas.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
          <LabelList dataKey="pct" position="right" className="fill-foreground text-[11px] tabular-nums" formatter={(v) => `${Number(v).toFixed(1)}%`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function Tendencia({ data }: { data: { mes: string; gastos: number; ingreso: number | null }[] }) {
  const config = { gastos: { label: 'Gastos', color: '#2a78d6' }, ingreso: { label: 'Ingreso', color: 'var(--foreground)' } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <ComposedChart data={data} margin={{ left: 0, right: 8, top: 16 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => moneyShort(Number(v))} />
        <ChartTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as (typeof data)[number]
            return (
              <div className="grid min-w-40 gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                <p className="font-medium capitalize">{label}</p>
                <Fila color="#2a78d6" label="Gastos" value={money(p.gastos)} />
                {p.ingreso != null && <Fila color="var(--foreground)" label="Ingreso" value={money(p.ingreso)} />}
                {p.ingreso ? <p className="text-muted-foreground">Usa el {pctLabel(p.gastos, p.ingreso)} del ingreso</p> : null}
              </div>
            )
          }}
        />
        <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        <Line dataKey="ingreso" type="monotone" stroke="var(--color-ingreso)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  )
}

function Fila({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipPorcion({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { nombre: string; valor: number; pct: number; color: string }
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2 font-medium">
        <span className="size-2.5 rounded-[3px]" style={{ background: d.color }} />
        {d.nombre}
      </div>
      <p className="tabular-nums">{money(d.valor)}</p>
      <p className="text-muted-foreground">{d.pct.toFixed(1)}% del total de gastos</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
