import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Download, Plus, Search, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { EstadoMesBanner } from '@/components/estado-mes'
import { CountUp, SlidingTabs } from '@/components/motion'
import { ResponsableBadge } from '@/components/responsable-badge'
import { useData } from '@/context/data'
import { useUi } from '@/context/ui'
import { fechaLarga, money, nombreMes } from '@/lib/format'
import { finDeMes } from '@/lib/metrics'
import type { Movimiento } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tipo = 'todos' | 'gasto' | 'ingreso'

/** Lo REAL: gastos pagados e ingresos recibidos, filtrables por rango de fechas. El mes de cada uno sale de su fecha. */
export function MovimientosPage() {
  const { loading, periodo, movimientos, categorias, catPorId, config } = useData()
  const { abrirMovimiento } = useUi()
  const [desde, setDesde] = useState(periodo)
  const [hasta, setHasta] = useState(finDeMes(periodo))
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [categoria, setCategoria] = useState('todas')
  const [responsable, setResponsable] = useState('todos')
  const [texto, setTexto] = useState('')

  // Al cambiar de mes en la barra superior, el rango pasa a ese mes
  useEffect(() => {
    setDesde(periodo)
    setHasta(finDeMes(periodo))
  }, [periodo])

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return movimientos.filter(
      (m) =>
        (!desde || m.fecha >= desde) &&
        (!hasta || m.fecha <= hasta) &&
        (tipo === 'todos' || m.tipo === tipo) &&
        (categoria === 'todas' || m.categoria_id === categoria) &&
        (responsable === 'todos' || (m.responsable || 'Familiar') === responsable) &&
        (!t || m.descripcion.toLowerCase().includes(t) || (m.notas ?? '').toLowerCase().includes(t)),
    )
  }, [movimientos, desde, hasta, tipo, categoria, responsable, texto])

  const ingresos = lista.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.valor), 0)
  const gastos = lista.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + Number(m.valor), 0)

  const porDia = useMemo(() => {
    const map = new Map<string, Movimiento[]>()
    for (const m of lista) map.set(m.fecha, [...(map.get(m.fecha) ?? []), m])
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [lista])

  async function exportar() {
    try {
      const XLSX = await import('xlsx')
      const hoja = XLSX.utils.json_to_sheet(
        lista.map((m) => ({
          Fecha: m.fecha,
          Mes: nombreMes(m.periodo),
          Tipo: m.tipo === 'gasto' ? 'Gasto' : 'Ingreso',
          Categoría: m.tipo === 'gasto' ? (catPorId.get(m.categoria_id ?? '')?.nombre ?? '') : (m.tipo_ingreso ?? ''),
          Concepto: m.descripcion,
          Valor: m.tipo === 'gasto' ? -Number(m.valor) : Number(m.valor),
          'Medio de pago': m.medio_pago ?? '',
          Responsable: m.responsable ?? 'Familiar',
          'Pago del plan': m.gasto_id ? 'Sí' : '',
          'Registrado por': m.pagado_por ?? '',
          Notas: m.notas ?? '',
        })),
      )
      hoja['!cols'] = [{ wch: 11 }, { wch: 15 }, { wch: 8 }, { wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 30 }]
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos')
      XLSX.writeFile(libro, `movimientos_${desde}_${hasta}.xlsx`)
    } catch (e) {
      toast.error('No se pudo exportar', { description: (e as Error).message })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Movimientos</h2>
          <p className="text-sm text-muted-foreground">Lo que realmente se pagó y se recibió. Cada movimiento queda en el mes de su fecha.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar} disabled={!lista.length}>
            <Download /> <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button size="sm" onClick={() => abrirMovimiento()}>
            <Plus /> Registrar
          </Button>
        </div>
      </div>

      <EstadoMesBanner periodo={periodo} />

      <Card className="reveal gap-3 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <div className="grid gap-1">
            <Label htmlFor="mv-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input id="mv-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="mv-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input id="mv-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="size-2 rounded-full" style={{ background: c.color }} />
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Persona</Label>
            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {config.responsables.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative col-span-2 grid gap-1">
            <Label htmlFor="mv-buscar" className="text-xs text-muted-foreground">
              Buscar
            </Label>
            <Search className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-muted-foreground" />
            <Input id="mv-buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Concepto o nota" className="pl-8" />
          </div>
        </div>
        <SlidingTabs
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'gasto', label: 'Gastos' },
            { value: 'ingreso', label: 'Ingresos' },
          ]}
        />
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Resumen label="Ingresos" valor={ingresos} tono="text-emerald-600 dark:text-emerald-400" i={0} />
        <Resumen label="Gastos" valor={gastos} tono="text-rose-600 dark:text-rose-400" i={1} />
        <Resumen label="Balance" valor={ingresos - gastos} tono={ingresos - gastos < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'} i={2} />
      </div>

      {loading && <Skeleton className="h-64 rounded-xl" />}

      {!loading && lista.length === 0 && (
        <Card className="items-center gap-3 p-10 text-center text-sm text-muted-foreground">
          <Wallet className="size-8 text-primary/60" />
          {movimientos.length ? 'Ningún movimiento coincide con los filtros.' : 'Todavía no hay movimientos. Registra el primer gasto pagado o ingreso recibido.'}
          <Button size="sm" onClick={() => abrirMovimiento()}>
            <Plus /> Registrar movimiento
          </Button>
        </Card>
      )}

      {porDia.map(([dia, items], n) => {
        const neto = items.reduce((s, m) => s + (m.tipo === 'ingreso' ? 1 : -1) * Number(m.valor), 0)
        return (
          <section key={dia} className="reveal overflow-hidden rounded-xl border bg-card shadow-xs" style={{ '--i': Math.min(n, 8) } as React.CSSProperties}>
            <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 text-xs sm:px-4">
              <span className="font-medium capitalize">{fechaLarga(dia)}</span>
              <span className={cn('tabular-nums', neto < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {neto < 0 ? '−' : '+'}
                {money(Math.abs(neto))}
              </span>
            </div>
            <div className="divide-y">
              {items.map((m) => {
                const cat = m.categoria_id ? catPorId.get(m.categoria_id) : undefined
                const ingreso = m.tipo === 'ingreso'
                return (
                  <button key={m.id} onClick={() => abrirMovimiento(m)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:px-4">
                    {ingreso ? (
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <ArrowDownLeft className="size-4" />
                      </span>
                    ) : cat ? (
                      <CategoryIcon icono={cat.icono} color={cat.color} size="sm" />
                    ) : (
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-600">
                        <ArrowUpRight className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{m.descripcion}</p>
                        {m.responsable && m.responsable !== 'Familiar' && <ResponsableBadge nombre={m.responsable} />}
                        {m.gasto_id && (
                          <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
                            <CalendarCheck /> Pago del plan
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {ingreso ? (m.tipo_ingreso ?? 'Ingreso') : (cat?.nombre ?? 'Sin categoría')}
                        {m.medio_pago && ` · ${m.medio_pago}`}
                        {m.pagado_por && ` · ${m.pagado_por}`}
                      </p>
                    </div>
                    <p className={cn('text-sm font-semibold tabular-nums', ingreso ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
                      {ingreso ? '+' : '−'}
                      {money(m.valor)}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Resumen({ label, valor, tono, i }: { label: string; valor: number; tono: string; i: number }) {
  return (
    <Card className="reveal gap-0 p-3 shadow-sm sm:p-4" style={{ '--i': i } as React.CSSProperties}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-base font-bold tracking-tight sm:text-xl', tono)}>
        <CountUp value={valor} format={money} />
      </p>
    </Card>
  )
}
