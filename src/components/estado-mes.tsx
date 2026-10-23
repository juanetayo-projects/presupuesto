import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Lock, LockOpen, Telescope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useData } from '@/context/data'
import { cerrarMes, reabrirMes } from '@/lib/api'
import { fechaCorta, nombreMes } from '@/lib/format'
import { resumen, valorGasto } from '@/lib/metrics'
import { cn } from '@/lib/utils'

/** Cerrar / reabrir un mes. Al cerrar se guarda la foto de sus totales y la base bloquea los cambios. */
export function useCierreMes() {
  const { gastos, ingresos, recargar } = useData()
  const [ocupado, setOcupado] = useState(false)

  async function cerrar(periodo: string) {
    const gs = gastos.filter((g) => g.periodo === periodo)
    const r = resumen(gs, ingresos.filter((i) => i.periodo === periodo))
    const msg =
      `¿Cerrar ${nombreMes(periodo)}?\n\nSus gastos e ingresos quedan congelados: no se podrán editar, pagar ni borrar hasta reabrirlo.` +
      (r.nPendientes ? `\n\nQuedan ${r.nPendientes} pago(s) pendientes que se guardarán como no pagados.` : '')
    if (!window.confirm(msg)) return
    setOcupado(true)
    try {
      const categorias: Record<string, number> = {}
      for (const g of gs) if (g.estado === 'pagado') categorias[g.categoria_id] = (categorias[g.categoria_id] ?? 0) + valorGasto(g)
      await cerrarMes(periodo, { ingreso: r.ingreso, total: r.total, pagado: r.pagado, pendiente: r.pendiente, categorias })
      toast.success(`${nombreMes(periodo)} cerrado`, { description: 'Sus valores ya no cambiarán.' })
      await recargar()
    } catch (e) {
      toast.error('No se pudo cerrar el mes', { description: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  async function reabrir(periodo: string) {
    if (!window.confirm(`¿Reabrir ${nombreMes(periodo)}? Sus gastos e ingresos se podrán modificar de nuevo.`)) return
    setOcupado(true)
    try {
      await reabrirMes(periodo)
      toast(`${nombreMes(periodo)} reabierto`)
      await recargar()
    } catch (e) {
      toast.error('No se pudo reabrir el mes', { description: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  return { cerrar, reabrir, ocupado }
}

/** Aviso bajo el título de la página según el mes: estimado, sin cerrar o cerrado. Nada en el mes en curso. */
export function EstadoMesBanner({ periodo }: { periodo: string }) {
  const { estadoMes, cierres } = useData()
  const { cerrar, reabrir, ocupado } = useCierreMes()
  const estado = estadoMes(periodo)
  if (estado === 'actual') return null
  const cierre = cierres.find((c) => c.periodo === periodo)

  const cfg = {
    futuro: {
      icon: Telescope,
      tono: 'border-violet-500/30 bg-violet-500/8 text-violet-800 dark:text-violet-200',
      texto: (
        <>
          <b>Mes futuro:</b> lo registrado aquí son <b>valores estimados a pagar</b>, no gastos realizados.
        </>
      ),
      accion: null,
    },
    pasado: {
      icon: CalendarClock,
      tono: 'border-amber-500/35 bg-amber-500/8 text-amber-800 dark:text-amber-200',
      texto: (
        <>
          <b>{nombreMes(periodo)} ya terminó</b> pero sigue abierto. Ciérralo para congelar sus valores y que no cambien al trabajar en otros meses.
        </>
      ),
      accion: (
        <Button size="sm" onClick={() => cerrar(periodo)} disabled={ocupado}>
          <Lock /> Cerrar mes
        </Button>
      ),
    },
    cerrado: {
      icon: Lock,
      tono: 'border-slate-500/30 bg-slate-500/8 text-slate-700 dark:text-slate-200',
      texto: (
        <>
          <b>Mes cerrado</b>
          {cierre ? ` el ${fechaCorta(cierre.cerrado_en.slice(0, 10))}${cierre.cerrado_por ? ` por ${cierre.cerrado_por.split('@')[0]}` : ''}` : ''}: sus valores están
          congelados y no se pueden modificar.
        </>
      ),
      accion: (
        <Button size="sm" variant="outline" onClick={() => reabrir(periodo)} disabled={ocupado}>
          <LockOpen /> Reabrir
        </Button>
      ),
    },
  }[estado]

  return (
    <div className={cn('reveal flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 text-sm', cfg.tono)}>
      <cfg.icon className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{cfg.texto}</p>
      {cfg.accion}
    </div>
  )
}
