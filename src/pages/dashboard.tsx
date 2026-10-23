import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownRight, ChevronDown, Copy, Download, Scissors, BellRing, CalendarClock, CheckCircle2, CircleDollarSign, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { IconoGasto, MarcaIcono } from '@/components/marca-icono'
import { FilterBar } from '@/components/filter-bar'
import { IngresoForm } from '@/components/ingresos'
import { KpiCard } from '@/components/kpi-card'
import { EstadoMesBanner } from '@/components/estado-mes'
import { BarraCarga, Gauge, useReducedMotion } from '@/components/motion'
import { MesAMes } from '@/components/mes-a-mes'
import { MetasResumen } from '@/components/metas'
import { PorResponsable } from '@/components/por-responsable'
import { Regla503020 } from '@/components/regla-503020'
import { useData, useFiltros } from '@/context/data'
import { useUi } from '@/context/ui'
import { useAlertasNavegador } from '@/hooks/use-alertas'
import { copiarMesAnterior, generarMes } from '@/lib/api'
import { exportarMesExcel } from '@/lib/export'
import { diasHasta, fechaCorta, mesCorto, money, moneyShort, nombreMes, pct, pctLabel, periodoMas } from '@/lib/format'
import { aplicarFiltros, deudaAlMes, porCategoria, porConcepto, resumen, valorGasto, type Porcion } from '@/lib/metrics'
import type { EstadoMes } from '@/lib/types'
import type { Ingreso } from '@/lib/types'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { loading, periodo, gastos, ingresos, categorias, conceptos, obligaciones, config, catPorId, recargar, estadoMes } = useData()
  const estado = estadoMes(periodo)
  const futuro = estado === 'futuro'
  const [filtros] = useFiltros('inicio')
  const { pagar } = useUi()
  const { alertas, cortes } = useAlertasNavegador()
  const [generando, setGenerando] = useState(false)
  const [nuevoIngreso, setNuevoIngreso] = useState<Partial<Ingreso> | null>(null)

  const gastosMes = useMemo(() => gastos.filter((g) => g.periodo === periodo), [gastos, periodo])
  const ingresosMes = useMemo(() => ingresos.filter((i) => i.periodo === periodo), [ingresos, periodo])
  const filtrados = useMemo(() => aplicarFiltros(gastosMes, { ...filtros, texto: '' }, config.diasAlerta), [gastosMes, filtros, config.diasAlerta])
  const r = useMemo(() => resumen(filtrados, ingresosMes), [filtrados, ingresosMes])
  const todosFiltrados = useMemo(() => aplicarFiltros(gastos, { ...filtros, texto: '' }, config.diasAlerta), [gastos, filtros, config.diasAlerta])
  const cats = useMemo(() => porCategoria(filtrados, categorias), [filtrados, categorias])
  const items = useMemo(() => porConcepto(filtrados, catPorId), [filtrados, catPorId])

  // Filtros propios de la gráfica de tendencia (además de los filtros de la página)
  const [tendCat, setTendCat] = useState('todas')
  const [tendConc, setTendConc] = useState('todos')
  const mesesTend = useMemo(() => Array.from({ length: 6 }, (_, i) => periodoMas(periodo, i - 5)), [periodo])
  const conceptosTend = useMemo(
    () =>
      [...new Set(todosFiltrados.filter((g) => mesesTend.includes(g.periodo) && (tendCat === 'todas' || g.categoria_id === tendCat)).map((g) => g.descripcion))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [todosFiltrados, mesesTend, tendCat],
  )
  const tendencia = useMemo(() => {
    return mesesTend.map((p) => {
      const gs = todosFiltrados.filter(
        (g) => g.periodo === p && g.estado !== 'omitido' && (tendCat === 'todas' || g.categoria_id === tendCat) && (tendConc === 'todos' || g.descripcion === tendConc),
      )
      const ing = ingresos.filter((x) => x.periodo === p).reduce((s, x) => s + Number(x.valor), 0)
      const total = gs.reduce((s, g) => s + valorGasto(g), 0)
      return { mes: mesCorto(p), gastos: total, ingreso: ing || null, estado: estadoMes(p) }
    })
  }, [todosFiltrados, ingresos, mesesTend, tendCat, tendConc, estadoMes])

  // Saldo de las deudas al cierre del mes elegido (no el de hoy), para que cada mes conserve su propia cifra
  const deudaTotal = useMemo(() => deudaAlMes(periodo, obligaciones, gastos, estado), [periodo, obligaciones, gastos, estado])
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
      const n = await copiarMesAnterior(periodo, gastosAnt, ingresos.filter((i) => i.periodo === anterior), ingresosMes, conceptos)
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
          <CardTitle>{nombreMes(periodo)} aún no tiene {futuro ? 'valores estimados' : 'presupuesto'}</CardTitle>
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
          <h2 className="text-xl font-semibold tracking-tight">
            {futuro ? 'Estimado de' : 'Resumen de'} {nombreMes(periodo)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Los porcentajes de las gráficas son respecto del total {futuro ? 'estimado' : 'de gastos'} del mes ({money(r.total)}).
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

      <EstadoMesBanner periodo={periodo} />

      <FilterBar pagina="inicio" buscar={false} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          solid
          i={0}
          label={futuro ? 'Ingreso estimado' : 'Ingreso del mes'}
          value={r.ingreso}
          icon={Wallet}
          tone="brand"
          hint={`${ingresosMes.length} ingreso(s) · toca para agregar`}
          onClick={() => setNuevoIngreso({ periodo, tipo: 'Otro', valor: 0 })}
        />
        <KpiCard
          i={1}
          label={futuro ? 'Total estimado' : 'Total gastos'}
          value={r.total}
          icon={Receipt}
          tone={usoIngreso > 90 ? 'bad' : usoIngreso > 75 ? 'warn' : 'default'}
          progress={usoIngreso}
          hint={`${pctLabel(r.total, r.ingreso)} del ingreso`}
        />
        <KpiCard i={2} label={futuro ? 'Pagado por anticipado' : 'Pagado'} value={r.pagado} icon={CheckCircle2} tone="good" progress={ejecucion} hint={`${r.nPagados} de ${r.n} · ${pctLabel(r.pagado, r.presupuestado)} ejecutado`} />
        <KpiCard
          i={3}
          label={futuro ? 'Estimado a pagar' : estado === 'cerrado' || estado === 'pasado' ? 'Quedó sin pagar' : 'Por pagar'}
          value={r.pendiente}
          icon={ArrowDownRight}
          tone="warn"
          hint={futuro ? `${r.nPendientes} pago(s) estimado(s)` : `${r.nPendientes} pago(s) pendiente(s)`}
        />
        <KpiCard
          solid
          i={4}
          label={futuro ? 'Disponible estimado' : 'Disponible'}
          value={r.disponible}
          icon={PiggyBank}
          tone={r.disponible < 0 ? 'bad' : 'good'}
          hint={r.disponible < 0 ? 'Gastos superan el ingreso' : `${pctLabel(r.disponible, r.ingreso)} del ingreso libre`}
        />
        <KpiCard
          i={5}
          label={futuro ? 'Deuda proyectada' : 'Deuda al cierre del mes'}
          value={deudaTotal}
          icon={Landmark}
          tone="default"
          hint={sinSaldo ? `${sinSaldo} obligación(es) sin saldo registrado` : futuro ? 'Si se pagan las cuotas estimadas' : 'Saldo de préstamos y tarjetas'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-primary" /> Alertas de pago
            </CardTitle>
            <CardDescription>Pagos vencidos y próximos {config.diasAlerta} días, y fechas de corte de tarjetas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cortes.map(({ o, fecha, dias }) => (
              <div key={`corte-${o.id}`} className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-2.5">
                <MarcaIcono logo={o.logo} icono="credit-card" color="#6250d6" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Corte {o.nombre}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {fechaCorta(fecha)} · {o.responsable || 'Familiar'}
                    </span>
                    <Badge variant="outline" className="h-5 border-violet-500/40 text-violet-700 dark:text-violet-300">
                      <Scissors /> {dias === 0 ? 'Corta hoy' : `Corte en ${dias}d`}
                    </Badge>
                  </div>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/deudas">Ver</Link>
                </Button>
              </div>
            ))}
            {alertas.length === 0 && cortes.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Sin pagos urgentes. ¡Todo al día!
              </div>
            )}
            {alertas.slice(0, 7).map(({ g, u }) => {
              const d = diasHasta(g.fecha_limite!)
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <IconoGasto g={g} size="sm" />
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
          <CardContent className="grid items-center gap-4 sm:grid-cols-[180px_1fr] lg:grid-cols-1 xl:grid-cols-[180px_1fr]">
            <DonutCategorias data={cats} total={r.total} />
            <ul className="min-w-0 space-y-2.5">
              {cats.map((c) => (
                <li key={c.key} className="text-sm">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      <span className="tabular-nums text-muted-foreground">{money(c.valor)}</span>
                      <span className="w-12 text-right font-medium tabular-nums">{c.pct.toFixed(1)}%</span>
                      <ChevronDown className="size-3.5 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <ul className="mt-1.5 mb-1 ml-4.5 grid gap-0.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                      {c.detalle.map((x) => (
                        <li key={x.nombre} className="flex gap-2">
                          <span className="min-w-0 flex-1 truncate">{x.nombre}</span>
                          <span className="tabular-nums">{money(x.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
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
            <CardDescription>
              {tendConc !== 'todos' ? `"${tendConc}"` : tendCat !== 'todas' ? (catPorId.get(tendCat)?.nombre ?? '') : 'Total de gastos'} (barras) frente al ingreso (línea)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Select
                value={tendCat}
                onValueChange={(v) => {
                  setTendCat(v)
                  setTendConc('todos')
                }}
              >
                <SelectTrigger size="sm" className={cn('min-w-0 flex-1', tendCat !== 'todas' && 'border-primary/60 bg-primary/10 text-primary')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="size-2 rounded-full" style={{ background: c.color }} />
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tendConc} onValueChange={setTendConc}>
                <SelectTrigger size="sm" className={cn('min-w-0 flex-1', tendConc !== 'todos' && 'border-primary/60 bg-primary/10 text-primary')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los conceptos</SelectItem>
                  {conceptosTend.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tendencia data={tendencia} />
          </CardContent>
        </Card>
      </div>

      <MesAMes periodo={periodo} gastos={todosFiltrados} categorias={categorias} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="reveal">
          <CardHeader>
            <CardTitle>Uso del ingreso</CardTitle>
            <CardDescription>{futuro ? 'Gasto estimado' : 'Gasto del mes'} frente al ingreso</CardDescription>
          </CardHeader>
          <CardContent>
            <Gauge
              pct={usoIngreso}
              label={`${money(r.total)} de ${money(r.ingreso)}`}
              sub={r.disponible >= 0 ? `Quedan ${money(r.disponible)}` : `Excede en ${money(-r.disponible)}`}
            />
          </CardContent>
        </Card>
        <Regla503020 gastos={filtrados} ingreso={r.ingreso} catPorId={catPorId} />
        <PorResponsable gastos={filtrados} responsables={config.responsables} />
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
                <BarraCarga pct={pct(pag, pres)} color={c.color} className="mt-1.5" />
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
    ? [
        ...top,
        {
          key: 'otros',
          nombre: `Otros (${resto.length})`,
          valor: resto.reduce((s, x) => s + x.valor, 0),
          pct: resto.reduce((s, x) => s + x.pct, 0),
          color: '#94a3b8',
          detalle: resto.map((x) => ({ nombre: x.nombre, valor: x.valor })),
        },
      ]
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

function Tendencia({ data }: { data: { mes: string; gastos: number; ingreso: number | null; estado: EstadoMes }[] }) {
  const reduce = useReducedMotion()
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
                <p className="font-medium capitalize">
                  {label}
                  {p.estado === 'futuro' && <span className="ml-1 font-normal text-violet-600 dark:text-violet-300">· estimado</span>}
                </p>
                <Fila color="#2a78d6" label={p.estado === 'futuro' ? 'Estimado' : 'Gastos'} value={money(p.gastos)} />
                {p.ingreso != null && <Fila color="var(--foreground)" label="Ingreso" value={money(p.ingreso)} />}
                {p.ingreso ? <p className="text-muted-foreground">Usa el {pctLabel(p.gastos, p.ingreso)} del ingreso</p> : null}
              </div>
            )
          }}
        />
        <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduce} animationDuration={700}>
          {data.map((d) => (
            <Cell
              key={d.mes}
              fillOpacity={d.estado === 'futuro' ? 0.35 : 1}
              stroke={d.estado === 'futuro' ? 'var(--color-gastos)' : undefined}
              strokeDasharray={d.estado === 'futuro' ? '4 3' : undefined}
            />
          ))}
        </Bar>
        <Line dataKey="ingreso" type="monotone" stroke="var(--color-ingreso)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls isAnimationActive={!reduce} animationDuration={1100} />
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
  const d = payload[0].payload as Porcion
  const det = d.detalle ?? []
  const MAX = 10
  return (
    <div className="grid w-64 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2 font-medium">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
        <span className="flex-1 truncate">{d.nombre}</span>
        <span className="tabular-nums">{money(d.valor)}</span>
      </div>
      <p className="text-muted-foreground">{d.pct.toFixed(1)}% del total de gastos</p>
      {det.length > 0 && (
        <ul className="grid gap-0.5 border-t pt-1.5">
          {det.slice(0, MAX).map((x, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">
                {x.nombre}
                {x.extra && <span className="text-muted-foreground"> · {x.extra}</span>}
              </span>
              <span className="tabular-nums">{money(x.valor)}</span>
              <span className="w-9 text-right text-muted-foreground tabular-nums">{d.valor ? ((x.valor / d.valor) * 100).toFixed(0) : 0}%</span>
            </li>
          ))}
          {det.length > MAX && <li className="text-muted-foreground">y {det.length - MAX} más…</li>}
        </ul>
      )}
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
