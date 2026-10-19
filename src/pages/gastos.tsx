import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, CalendarDays, Check, CopyPlus, Download, Layers, List, Pencil, Plus, Undo2 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CalendarioPagos } from '@/components/calendario-pagos'
import { exportarMesExcel } from '@/lib/export'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { FilterBar } from '@/components/filter-bar'
import { useData, useFiltros } from '@/context/data'
import { useUi } from '@/context/ui'
import { deshacerPago, generarMes } from '@/lib/api'
import { diasHasta, fechaCorta, money, nombreMes, pctLabel } from '@/lib/format'
import { aplicarFiltros, resumen, urgencia, valorGasto } from '@/lib/metrics'
import type { Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

export function GastosPage() {
  const { loading, periodo, gastos, ingresos, categorias, conceptos, obligaciones, config, recargar } = useData()
  const [filtros] = useFiltros('gastos')
  const { abrirGasto } = useUi()
  const [generando, setGenerando] = useState(false)
  const [vista, setVista] = useState<'lista' | 'calendario'>(() => {
    try {
      return localStorage.getItem('ppto.vista') === 'calendario' ? 'calendario' : 'lista'
    } catch {
      return 'lista'
    }
  })
  const cambiarVista = (v: string) => {
    if (!v) return
    setVista(v as 'lista' | 'calendario')
    try {
      localStorage.setItem('ppto.vista', v)
    } catch {
      /* sin almacenamiento */
    }
  }

  const gastosMes = useMemo(() => gastos.filter((g) => g.periodo === periodo), [gastos, periodo])
  const ingresosMes = useMemo(() => ingresos.filter((i) => i.periodo === periodo), [ingresos, periodo])
  const lista = useMemo(() => aplicarFiltros(gastosMes, filtros, config.diasAlerta), [gastosMes, filtros, config.diasAlerta])
  const totalMes = useMemo(() => resumen(gastosMes, ingresosMes).total, [gastosMes, ingresosMes])
  const r = useMemo(() => resumen(lista, ingresosMes), [lista, ingresosMes])

  const grupos = useMemo(
    () =>
      categorias
        .map((c) => {
          const items = lista
            .filter((g) => g.categoria_id === c.id)
            .sort((a, b) => (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999') || a.descripcion.localeCompare(b.descripcion))
          return { c, items, total: items.filter((g) => g.estado !== 'omitido').reduce((s, g) => s + valorGasto(g), 0) }
        })
        .filter((x) => x.items.length > 0),
    [categorias, lista],
  )

  const faltantes = conceptos.filter((c) => c.activo && c.recurrente && !gastosMes.some((g) => g.concepto_id === c.id)).length

  async function completarMes() {
    setGenerando(true)
    try {
      const n = await generarMes(periodo, conceptos, gastosMes, ingresosMes, config.ingresoBase)
      toast.success(`Se agregaron ${n} gastos de la plantilla`)
      await recargar()
    } catch (e) {
      toast.error('No se pudo completar el mes', { description: (e as Error).message })
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Gastos de {nombreMes(periodo)}</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {lista.length} gastos · {money(r.total)} · pagado {money(r.pagado)} · pendiente {money(r.pendiente)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={vista} onValueChange={cambiarVista}>
            <ToggleGroupItem value="lista" aria-label="Vista lista">
              <List />
            </ToggleGroupItem>
            <ToggleGroupItem value="calendario" aria-label="Vista calendario">
              <CalendarDays />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            aria-label="Exportar a Excel"
            onClick={() => exportarMesExcel(periodo, lista, ingresosMes, categorias, obligaciones).catch((e) => toast.error('No se pudo exportar', { description: e.message }))}
          >
            <Download /> <span className="hidden sm:inline">Excel</span>
          </Button>
          {faltantes > 0 && (
            <Button variant="outline" size="sm" onClick={completarMes} disabled={generando}>
              <CopyPlus /> {gastosMes.length ? `Agregar ${faltantes} de la plantilla` : 'Generar mes'}
            </Button>
          )}
          <Button size="sm" className="hidden md:inline-flex" onClick={() => abrirGasto()}>
            <Plus /> Nuevo gasto
          </Button>
        </div>
      </div>

      <FilterBar pagina="gastos" />

      {loading && <Skeleton className="h-64 rounded-xl" />}

      {!loading && vista === 'lista' && grupos.length === 0 && (
        <Card className="items-center p-10 text-center text-sm text-muted-foreground">
          {gastosMes.length ? 'Ningún gasto coincide con los filtros.' : 'Este mes no tiene gastos todavía.'}
        </Card>
      )}

      {!loading && vista === 'calendario' && <CalendarioPagos periodo={periodo} gastos={lista} diasAlerta={config.diasAlerta} onSelect={abrirGasto} />}

      {vista === 'lista' && grupos.map(({ c, items, total }) => (
        <section key={c.id} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CategoryIcon icono={c.icono} color={c.color} size="sm" />
            <h3 className="text-sm font-semibold">{c.nombre}</h3>
            <span className="ml-auto text-sm font-medium tabular-nums">{money(total)}</span>
            <Badge variant="secondary" className="tabular-nums">
              {pctLabel(total, totalMes)}
            </Badge>
          </div>
          <Card className="gap-0 divide-y overflow-hidden py-0">
            {items.map((g) => (
              <FilaGasto key={g.id} g={g} />
            ))}
          </Card>
        </section>
      ))}
    </div>
  )
}

function FilaGasto({ g }: { g: Gasto }) {
  const { config, recargar } = useData()
  const { abrirGasto, pagar } = useUi()
  const u = urgencia(g, config.diasAlerta)
  const pagado = g.estado === 'pagado'

  async function deshacer() {
    try {
      await deshacerPago(g)
      toast('Pago deshecho', { description: g.descripcion })
      await recargar()
    } catch (e) {
      toast.error('No se pudo deshacer', { description: (e as Error).message })
    }
  }

  return (
    <div className={cn('flex items-center gap-3 px-3 py-3 sm:px-4', pagado && 'bg-muted/30')}>
      <button
        onClick={() => (pagado ? deshacer() : pagar(g))}
        aria-label={pagado ? 'Deshacer pago' : 'Registrar pago'}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90',
          pagado ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/30 text-transparent hover:border-emerald-500 hover:text-emerald-500',
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => abrirGasto(g)}>
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm font-medium', pagado && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{g.descripcion}</p>
          {g.estado === 'pendiente' && Number(g.valor_presupuestado) === 0 && (
            <Badge variant="outline" className="shrink-0 border-amber-500/50 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">
              Definir valor
            </Badge>
          )}
          {g.cuotas_total && (
            <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
              <Layers /> {g.cuota_num}/{g.cuotas_total}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {g.medio_pago && <span>{g.medio_pago}</span>}
          {pagado ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              Pagado {fechaCorta(g.fecha_pago)}
              {g.pagado_por && ` · ${g.pagado_por}`}
            </span>
          ) : (
            <EtiquetaFecha g={g} u={u} />
          )}
        </div>
      </button>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">{money(valorGasto(g))}</p>
        {pagado && Number(g.valor_pagado) !== Number(g.valor_presupuestado) && (
          <p className="text-[11px] text-muted-foreground tabular-nums">ppto {money(g.valor_presupuestado)}</p>
        )}
      </div>
      <div className="hidden gap-1 sm:flex">
        <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => abrirGasto(g)}>
          <Pencil />
        </Button>
        {pagado && (
          <Button variant="ghost" size="icon-sm" aria-label="Deshacer pago" onClick={deshacer}>
            <Undo2 />
          </Button>
        )}
      </div>
    </div>
  )
}

function EtiquetaFecha({ g, u }: { g: Gasto; u: ReturnType<typeof urgencia> }) {
  if (!g.fecha_limite) return <span>Sin fecha límite</span>
  const d = diasHasta(g.fecha_limite)
  if (u === 'vencido')
    return (
      <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
        <AlertTriangle className="size-3" /> Venció {fechaCorta(g.fecha_limite)} ({-d}d)
      </span>
    )
  if (u === 'hoy') return <span className="font-medium text-amber-600 dark:text-amber-400">Vence hoy</span>
  if (u === 'pronto')
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <CalendarClock className="size-3" /> Vence {fechaCorta(g.fecha_limite)} · en {d}d
      </span>
    )
  return <span>Vence {fechaCorta(g.fecha_limite)}</span>
}
