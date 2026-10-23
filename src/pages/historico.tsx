import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChevronRight, Download, Lock, LockOpen, Telescope, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { useCierreMes } from '@/components/estado-mes'
import { CountUp, SlidingTabs, useCarga, useReducedMotion } from '@/components/motion'
import { useData } from '@/context/data'
import { mesCorto, money, moneyShort, nombreMes, periodoActual, periodoMas } from '@/lib/format'
import { ETIQUETA_MES, valorHistorico } from '@/lib/metrics'
import type { Categoria, EstadoMes } from '@/lib/types'
import { cn } from '@/lib/utils'

type Rango = '6' | '12' | 'anio'
type Modo = 'real' | 'presupuesto'

const TONO_ESTADO: Record<EstadoMes, string> = {
  cerrado: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
  pasado: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  actual: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  futuro: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
}

interface FilaCat {
  c: Categoria
  valores: number[]
  total: number
  conceptos: { nombre: string; valores: number[]; total: number }[]
}

/**
 * Histórico mes a mes. Cada mes conserva sus propios valores: en meses pasados y el actual se ve lo
 * realmente pagado (gasto realizado); en meses futuros, los valores estimados a pagar.
 */
export function HistoricoPage() {
  const { loading, periodo, setPeriodo, gastos, ingresos, categorias, estadoMes } = useData()
  const { cerrar, reabrir, ocupado } = useCierreMes()
  const [rango, setRango] = useState<Rango>('6')
  const [modo, setModo] = useState<Modo>('real')
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  const periodos = useMemo(() => {
    if (rango === 'anio') {
      const y = periodo.slice(0, 4)
      return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}-01`)
    }
    const n = Number(rango)
    // La ventana termina en el último mes con datos (p. ej. cuotas ya proyectadas), sin pasar de 3 meses adelante.
    const hoy = periodoActual()
    const tope = periodoMas(hoy, 3)
    const ultimo = gastos.reduce((m, g) => (g.periodo > m && g.periodo <= tope ? g.periodo : m), hoy)
    const fin = periodo > ultimo ? periodo : ultimo
    return Array.from({ length: n }, (_, i) => periodoMas(fin, i - n + 1))
  }, [rango, periodo, gastos])

  const estados = useMemo(() => periodos.map(estadoMes), [periodos, estadoMes])

  const datos = useMemo(() => {
    const idx = new Map(periodos.map((p, i) => [p, i]))
    const ceros = () => periodos.map(() => 0)
    const porCat = new Map<string, { valores: number[]; conceptos: Map<string, number[]> }>()
    const pendientes = ceros()
    for (const g of gastos) {
      const i = idx.get(g.periodo)
      if (i === undefined || g.estado === 'omitido') continue
      const v = valorHistorico(g, estados[i], modo)
      if (modo === 'real' && estados[i] !== 'futuro' && g.estado === 'pendiente') pendientes[i] += Number(g.valor_presupuestado)
      if (!porCat.has(g.categoria_id)) porCat.set(g.categoria_id, { valores: ceros(), conceptos: new Map() })
      const x = porCat.get(g.categoria_id)!
      x.valores[i] += v
      if (!x.conceptos.has(g.descripcion)) x.conceptos.set(g.descripcion, ceros())
      x.conceptos.get(g.descripcion)![i] += v
    }
    const filas: FilaCat[] = categorias
      .filter((c) => porCat.get(c.id)?.valores.some(Boolean))
      .map((c) => {
        const x = porCat.get(c.id)!
        return {
          c,
          valores: x.valores,
          total: x.valores.reduce((a, b) => a + b, 0),
          conceptos: [...x.conceptos]
            .map(([nombre, valores]) => ({ nombre, valores, total: valores.reduce((a, b) => a + b, 0) }))
            .filter((k) => k.total > 0)
            .sort((a, b) => b.total - a.total),
        }
      })
    const totales = periodos.map((_, i) => filas.reduce((s, f) => s + f.valores[i], 0))
    const ingreso = periodos.map((p) => ingresos.filter((x) => x.periodo === p).reduce((s, x) => s + Number(x.valor), 0))
    return { filas, totales, ingreso, pendientes }
  }, [gastos, ingresos, categorias, periodos, estados, modo])

  // Meses transcurridos con datos (un mes vacío no baja el promedio)
  const iReal = estados.map((e, i) => (e !== 'futuro' && datos.totales[i] > 0 ? i : -1)).filter((i) => i >= 0)
  const totalReal = iReal.reduce((s, i) => s + datos.totales[i], 0)
  const promedio = iReal.length ? totalReal / iReal.length : 0
  const totalEstimado = estados.reduce((s, e, i) => s + (e === 'futuro' ? datos.totales[i] : 0), 0)
  const sinCerrar = periodos.filter((_, i) => estados[i] === 'pasado')

  const alternar = (id: string) =>
    setAbiertas((x) => {
      const n = new Set(x)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function exportar() {
    try {
      const XLSX = await import('xlsx')
      const cab = ['Categoría / concepto', ...periodos.map((p, i) => `${nombreMes(p)}${estados[i] === 'futuro' ? ' (estimado)' : ''}`), 'Total']
      const filas: (string | number)[][] = []
      for (const f of datos.filas) {
        filas.push([f.c.nombre, ...f.valores, f.total])
        for (const k of f.conceptos) filas.push([`   ${k.nombre}`, ...k.valores, k.total])
      }
      const hoja = XLSX.utils.aoa_to_sheet([
        ['Presupuesto familia Etayo-Murillo · Histórico mes a mes'],
        [modo === 'real' ? 'Gasto realizado (pagado); meses futuros = estimado a pagar' : 'Valores presupuestados'],
        [],
        cab,
        ...filas,
        [],
        ['Total', ...datos.totales, datos.totales.reduce((a, b) => a + b, 0)],
        ['Ingreso', ...datos.ingreso, datos.ingreso.reduce((a, b) => a + b, 0)],
        ['Disponible', ...datos.ingreso.map((v, i) => v - datos.totales[i])],
        ['Estado del mes', ...estados.map((e) => ETIQUETA_MES[e])],
      ])
      hoja['!cols'] = [{ wch: 32 }, ...periodos.map(() => ({ wch: 16 })), { wch: 16 }]
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Histórico')
      XLSX.writeFile(libro, `historico-${periodos[0].slice(0, 7)}_${periodos[periodos.length - 1].slice(0, 7)}.xlsx`)
    } catch (e) {
      toast.error('No se pudo exportar', { description: (e as Error).message })
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Histórico mes a mes</h2>
          <p className="text-sm text-muted-foreground">
            {modo === 'real' ? 'Lo realmente pagado en cada mes. Los meses futuros muestran lo estimado a pagar.' : 'Lo presupuestado en cada mes.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidingTabs
            value={modo}
            onChange={setModo}
            options={[
              { value: 'real', label: 'Realizado' },
              { value: 'presupuesto', label: 'Presupuestado' },
            ]}
          />
          <SlidingTabs
            value={rango}
            onChange={setRango}
            options={[
              { value: '6', label: '6 meses' },
              { value: '12', label: '12 meses' },
              { value: 'anio', label: `Año ${periodo.slice(0, 4)}` },
            ]}
          />
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download /> <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      <StepperMeses periodos={periodos} estados={estados} periodo={periodo} onSelect={setPeriodo} />

      {sinCerrar.length > 0 && (
        <div className="reveal flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          <Lock className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            {sinCerrar.length === 1 ? `${nombreMes(sinCerrar[0])} ya terminó y sigue abierto.` : `${sinCerrar.length} meses ya terminaron y siguen abiertos.`} Ciérralos para
            congelar sus valores.
          </p>
          <Button size="sm" onClick={() => cerrar(sinCerrar[0])} disabled={ocupado}>
            <Lock /> Cerrar {mesCorto(sinCerrar[0])}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumen i={0} label={modo === 'real' ? 'Gastado en el periodo' : 'Presupuestado'} valor={totalReal} hint={`${iReal.length} mes(es) transcurridos`} />
        <Resumen i={1} label="Promedio mensual" valor={promedio} hint="Meses pasados y el actual" />
        <Resumen i={2} label="Estimado a pagar" valor={totalEstimado} hint="Meses futuros" estimado />
        <Resumen
          i={3}
          label="Mayor categoría"
          texto={datos.filas.length ? [...datos.filas].sort((a, b) => b.total - a.total)[0].c.nombre : '—'}
          hint={datos.filas.length ? money([...datos.filas].sort((a, b) => b.total - a.total)[0].total) : ''}
        />
      </div>

      <TendenciaArea periodos={periodos} estados={estados} totales={datos.totales} ingreso={datos.ingreso} />

      <Card className="reveal gap-0 py-0" style={{ '--i': 2 } as React.CSSProperties}>
        <CardHeader className="py-4">
          <CardTitle>Tabla de gastos por mes</CardTitle>
          <CardDescription>Toca una categoría para ver sus conceptos · toca un mes para abrirlo en Inicio y Gastos</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-44 border-b bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoría</th>
                {periodos.map((p, i) => (
                  <th
                    key={p}
                    className={cn('border-b px-3 py-2 text-right align-bottom', p === periodo && 'bg-primary/10', estados[i] === 'futuro' && 'rayado text-violet-500/70')}
                  >
                    <button onClick={() => setPeriodo(p)} className="block w-full text-right text-xs font-semibold text-foreground capitalize hover:text-primary">
                      {mesCorto(p)}
                    </button>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className={cn('rounded-full px-1.5 py-px text-[10px] font-medium', TONO_ESTADO[estados[i]])}>{ETIQUETA_MES[estados[i]]}</span>
                      {(estados[i] === 'pasado' || estados[i] === 'actual') && (
                        <button
                          onClick={() => cerrar(p)}
                          disabled={ocupado}
                          title={`Cerrar ${nombreMes(p)}`}
                          aria-label={`Cerrar ${nombreMes(p)}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Lock className="size-3" />
                        </button>
                      )}
                      {estados[i] === 'cerrado' && (
                        <button
                          onClick={() => reabrir(p)}
                          disabled={ocupado}
                          title={`Reabrir ${nombreMes(p)}`}
                          aria-label={`Reabrir ${nombreMes(p)}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <LockOpen className="size-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="border-b px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.length === 0 && (
                <tr>
                  <td colSpan={periodos.length + 2} className="px-3 py-10 text-center text-muted-foreground">
                    No hay gastos en estos meses.
                  </td>
                </tr>
              )}
              {datos.filas.map((f) => {
                const abierta = abiertas.has(f.c.id)
                return (
                  <Fragment key={f.c.id}>
                    <tr className="group">
                      <th className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left font-medium group-hover:bg-muted">
                        <button onClick={() => alternar(f.c.id)} className="flex w-full items-center gap-2 text-left" aria-expanded={abierta}>
                          <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', abierta && 'rotate-90')} />
                          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: f.c.color }} />
                          <span className="truncate">{f.c.nombre}</span>
                        </button>
                      </th>
                      {f.valores.map((v, i) => (
                        <Celda key={i} v={v} estado={estados[i]} sel={periodos[i] === periodo} />
                      ))}
                      <td className="border-b px-3 py-2 text-right font-semibold tabular-nums group-hover:bg-muted/50">{money(f.total)}</td>
                    </tr>
                    {abierta &&
                      f.conceptos.map((k) => (
                        <tr key={k.nombre} className="reveal text-xs text-muted-foreground">
                          <th className="sticky left-0 z-10 border-b bg-card py-1.5 pr-3 pl-10 text-left font-normal">
                            <span className="block max-w-56 truncate">{k.nombre}</span>
                          </th>
                          {k.valores.map((v, i) => (
                            <Celda key={i} v={v} estado={estados[i]} sel={periodos[i] === periodo} chica />
                          ))}
                          <td className="border-b px-3 py-1.5 text-right tabular-nums">{money(k.total)}</td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
            {datos.filas.length > 0 && (
              <tfoot className="font-semibold">
                <FilaPie label={modo === 'real' ? 'Total gastado / estimado' : 'Total presupuestado'} valores={datos.totales} estados={estados} periodos={periodos} periodo={periodo} fuerte />
                <FilaPie label="Ingreso" valores={datos.ingreso} estados={estados} periodos={periodos} periodo={periodo} />
                <FilaPie
                  label="Disponible"
                  valores={datos.ingreso.map((v, i) => v - datos.totales[i])}
                  estados={estados}
                  periodos={periodos}
                  periodo={periodo}
                  colorear
                />
                {modo === 'real' && datos.pendientes.some(Boolean) && (
                  <FilaPie label="Pendiente sin pagar" valores={datos.pendientes} estados={estados} periodos={periodos} periodo={periodo} tenue />
                )}
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Evolución por categoría</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {datos.filas.map((f, n) => (
            <GraficoCategoria key={f.c.id} f={f} periodos={periodos} estados={estados} periodo={periodo} i={n} conDatos={iReal} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Celda({ v, estado, sel, chica }: { v: number; estado: EstadoMes; sel: boolean; chica?: boolean }) {
  return (
    <td
      className={cn(
        'border-b px-3 text-right tabular-nums',
        chica ? 'py-1.5' : 'py-2',
        sel && 'bg-primary/5',
        estado === 'futuro' && 'text-violet-700 italic dark:text-violet-300',
        !v && 'text-muted-foreground/50',
      )}
    >
      {v ? money(v) : '—'}
    </td>
  )
}

function FilaPie({
  label,
  valores,
  estados,
  periodos,
  periodo,
  fuerte,
  colorear,
  tenue,
}: {
  label: string
  valores: number[]
  estados: EstadoMes[]
  periodos: string[]
  periodo: string
  fuerte?: boolean
  colorear?: boolean
  tenue?: boolean
}) {
  return (
    <tr className={cn(fuerte && 'bg-muted/40', tenue && 'text-xs font-normal text-muted-foreground')}>
      <th className={cn('sticky left-0 z-10 border-b px-3 py-2 text-left', fuerte ? 'bg-muted' : 'bg-card')}>{label}</th>
      {valores.map((v, i) => (
        <td
          key={periodos[i]}
          className={cn(
            'border-b px-3 py-2 text-right tabular-nums',
            periodos[i] === periodo && 'bg-primary/5',
            estados[i] === 'futuro' && 'italic',
            colorear && (v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'),
          )}
        >
          {v ? money(v) : '—'}
        </td>
      ))}
      <td className="border-b px-3 py-2 text-right tabular-nums">{colorear ? '' : money(valores.reduce((a, b) => a + b, 0))}</td>
    </tr>
  )
}

function Resumen({ label, valor, texto, hint, estimado, i }: { label: string; valor?: number; texto?: string; hint?: string; estimado?: boolean; i: number }) {
  return (
    <Card
      className={cn('reveal gap-0 p-4 shadow-sm', estimado && 'border-violet-500/30 bg-linear-to-br from-violet-500/10 to-card')}
      style={{ '--i': i } as React.CSSProperties}
    >
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {estimado && <Telescope className="size-3" />}
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold tracking-tight sm:text-xl">{valor !== undefined ? <CountUp value={valor} format={money} /> : texto}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  )
}

/** Nodos de mes unidos por una línea que se llena hasta hoy ("Step → done"). */
function StepperMeses({ periodos, estados, periodo, onSelect }: { periodos: string[]; estados: EstadoMes[]; periodo: string; onSelect: (p: string) => void }) {
  const hoy = periodoActual()
  const iHoy = periodos.findIndex((p) => p >= hoy)
  const avance = periodos.length > 1 ? ((iHoy < 0 ? periodos.length - 1 : iHoy) / (periodos.length - 1)) * 100 : 100
  const w = useCarga(avance)
  return (
    <Card className="reveal overflow-x-auto px-4 py-3">
      <div className="relative min-w-[480px]">
        <div className="absolute top-3.5 h-0.5 bg-muted" style={{ left: `${50 / periodos.length}%`, right: `${50 / periodos.length}%` }}>
          <div className="barra-carga h-full bg-primary" style={{ width: `${w}%` }} />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${periodos.length}, minmax(0, 1fr))` }}>
          {periodos.map((p, i) => {
            const e = estados[i]
            return (
              <li key={p} className="flex flex-col items-center">
                <button
                  onClick={() => onSelect(p)}
                  title={`${nombreMes(p)} · ${ETIQUETA_MES[e]}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className={cn(
                    'pop grid size-7 place-items-center rounded-full border-2 text-[10px] font-bold transition',
                    e === 'cerrado' && 'border-primary bg-primary text-primary-foreground',
                    e === 'pasado' && 'border-amber-500 bg-card text-amber-600',
                    e === 'actual' && 'latido border-emerald-500 bg-emerald-500 text-white',
                    e === 'futuro' && 'border-dashed border-violet-400 bg-card text-violet-500',
                    p === periodo && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-card',
                  )}
                >
                  {e === 'cerrado' ? <Lock className="size-3" /> : e === 'futuro' ? <Telescope className="size-3" /> : p.slice(5, 7)}
                </button>
                <span className={cn('mt-1 text-[11px] capitalize', p === periodo ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{mesCorto(p)}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}

/** Gastado frente al ingreso: la línea se dibuja sola y el área se llena debajo ("Line → area"). */
function TendenciaArea({ periodos, estados, totales, ingreso }: { periodos: string[]; estados: EstadoMes[]; totales: number[]; ingreso: number[] }) {
  const reduce = useReducedMotion()
  const iUltimoReal = estados.reduce((m, e, i) => (e !== 'futuro' ? i : m), -1)
  const data = periodos.map((p, i) => ({
    mes: mesCorto(p),
    estado: estados[i],
    real: estados[i] !== 'futuro' ? totales[i] : null,
    // la serie estimada arranca en el último mes real para que las dos líneas queden unidas
    estimado: estados[i] === 'futuro' || i === iUltimoReal ? totales[i] : null,
    ingreso: ingreso[i] || null,
  }))
  const config = {
    real: { label: 'Gastado', color: '#2a78d6' },
    estimado: { label: 'Estimado', color: '#7c5cff' },
    ingreso: { label: 'Ingreso', color: 'var(--foreground)' },
  } satisfies ChartConfig
  return (
    <Card className="reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <CardHeader>
        <CardTitle>Gastado frente al ingreso</CardTitle>
        <CardDescription>Línea continua: gasto realizado · línea punteada: estimado a pagar</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-60 w-full">
          <ComposedChart data={data} margin={{ left: 0, right: 8, top: 12 }}>
            <defs>
              <linearGradient id="area-real" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2a78d6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="area-est" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#7c5cff" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => moneyShort(Number(v))} />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as (typeof data)[number]
                const v = d.real ?? d.estimado ?? 0
                return (
                  <div className="grid min-w-40 gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium capitalize">
                      {label} · <span className="font-normal text-muted-foreground">{ETIQUETA_MES[d.estado]}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{d.estado === 'futuro' ? 'Estimado a pagar' : 'Gastado'}</span>
                      <b className="tabular-nums">{money(v)}</b>
                    </p>
                    {d.ingreso && (
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Ingreso</span>
                        <span className="tabular-nums">{money(d.ingreso)}</span>
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Area dataKey="real" type="monotone" stroke="#2a78d6" strokeWidth={2.5} fill="url(#area-real)" dot={{ r: 3 }} connectNulls={false} isAnimationActive={!reduce} animationDuration={1200} />
            <Area
              dataKey="estimado"
              type="monotone"
              stroke="#7c5cff"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#area-est)"
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={!reduce}
              animationBegin={900}
              animationDuration={800}
            />
            <Line dataKey="ingreso" type="monotone" stroke="var(--color-ingreso)" strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={!reduce} animationDuration={1200} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function GraficoCategoria({ f, periodos, estados, periodo, i, conDatos }: { f: FilaCat; periodos: string[]; estados: EstadoMes[]; periodo: string; i: number; conDatos: number[] }) {
  const reduce = useReducedMotion()
  const data = periodos.map((p, k) => ({ mes: mesCorto(p), valor: f.valores[k], estado: estados[k], p }))
  // Variación del mes elegido (o el último real) frente al mes anterior
  const k = Math.max(1, periodos.includes(periodo) ? periodos.indexOf(periodo) : estados.lastIndexOf('actual'))
  const actual = f.valores[k] ?? 0
  const previo = f.valores[k - 1] ?? 0
  const varPct = previo ? ((actual - previo) / previo) * 100 : null
  const reales = conDatos.map((n) => f.valores[n])
  const prom = reales.length ? reales.reduce((a, b) => a + b, 0) / reales.length : 0
  return (
    <Card className="reveal gap-3 py-4" style={{ '--i': Math.min(i + 3, 12) } as React.CSSProperties}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CategoryIcon icono={f.c.icono} color={f.c.color} size="sm" />
          <span className="truncate">{f.c.nombre}</span>
        </CardTitle>
        <CardDescription className="tabular-nums">Promedio {money(prom)} / mes</CardDescription>
        <CardAction className="text-right">
          <p className="text-sm font-semibold">
            <CountUp value={f.total} format={money} />
          </p>
          {varPct !== null && Number.isFinite(varPct) && (
            <p className={cn('flex items-center justify-end gap-0.5 text-[11px] font-medium tabular-nums', varPct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {varPct > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(varPct).toFixed(0)}% vs {mesCorto(periodos[k - 1])}
            </p>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        <ChartContainer config={{ valor: { label: f.c.nombre, color: f.c.color } }} className="aspect-auto h-32 w-full">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
            <XAxis dataKey="mes" tickLine={false} axisLine={false} interval={periodos.length > 6 ? 1 : 0} tick={{ fontSize: 10 }} />
            <YAxis hide domain={[0, 'dataMax']} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.25 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="font-medium capitalize">
                      {nombreMes(d.p)} {d.estado === 'futuro' && <span className="font-normal text-violet-600 dark:text-violet-300">· estimado</span>}
                    </p>
                    <p className="tabular-nums">{money(d.valor)}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationBegin={i * 60} animationDuration={700}>
              {data.map((d) => (
                <Cell
                  key={d.p}
                  fill={f.c.color}
                  fillOpacity={d.estado === 'futuro' ? 0.3 : d.p === periodo ? 1 : 0.8}
                  stroke={d.estado === 'futuro' ? f.c.color : undefined}
                  strokeDasharray={d.estado === 'futuro' ? '3 2' : undefined}
                />
              ))}
            </Bar>
            <CartesianGrid vertical={false} horizontal={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
