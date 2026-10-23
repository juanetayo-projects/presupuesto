import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, ChevronDown, Copy, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { clonarPlan } from '@/lib/api'
import { money, nombreMes, periodoMas } from '@/lib/format'
import { finDeMes, planClonado, type OpcionesClonar } from '@/lib/metrics'
import { CLASES_GASTO, type ClaseGasto } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONO: Record<ClaseGasto, string> = {
  credito: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  fijo: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  variable: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export function BadgeClase({ clase }: { clase: ClaseGasto }) {
  return (
    <Badge variant="outline" className={cn('shrink-0 px-1.5 text-[10px]', TONO[clase])}>
      {CLASES_GASTO[clase].label}
    </Badge>
  )
}

/**
 * Clonar el plan de un mes a otro: créditos (con lo no pagado arrastrado), gastos fijos y, si se quiere, variables
 * e ingresos esperados. Muestra la vista previa antes de crear nada.
 */
export function ClonarPlanDialog({ open, onClose, destinoInicial }: { open: boolean; onClose: () => void; destinoInicial: string }) {
  const { gastos, conceptos, ingresos, obligaciones, movimientos, estadoMes, recargar } = useData()
  const [origen, setOrigen] = useState(periodoMas(destinoInicial, -1))
  const [destino, setDestino] = useState(destinoInicial)
  const [op, setOp] = useState<OpcionesClonar>({ credito: true, fijo: true, variable: false, arrastrar: true, ingresos: true })
  const [verSaltados, setVerSaltados] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setDestino(destinoInicial)
    // Origen por defecto: el último mes anterior al destino que tenga plan
    const previos = [...new Set(gastos.map((g) => g.periodo))].filter((p) => p < destinoInicial).sort()
    setOrigen(previos[previos.length - 1] ?? periodoMas(destinoInicial, -1))
    setVerSaltados(false)
  }, [open, destinoInicial, gastos])

  const { filas, saltados } = useMemo(() => planClonado(origen, destino, gastos, conceptos, op), [origen, destino, gastos, conceptos, op])
  const ingresosOrigen = ingresos.filter((i) => i.periodo === origen)
  const ingresosDestino = ingresos.filter((i) => i.periodo === destino)
  const copiaIngresos = op.ingresos && ingresosDestino.length === 0 && ingresosOrigen.length > 0
  const total = filas.reduce((s, f) => s + f.valor, 0)
  const totalArrastre = filas.reduce((s, f) => s + f.arrastre, 0)
  const destinoCerrado = estadoMes(destino) === 'cerrado'
  const invalido = !origen || !destino || origen === destino

  // Saldo de cada deuda al cierre del mes origen, para mostrarlo junto a su cuota
  const saldoDeuda = useMemo(() => {
    const fin = finDeMes(origen)
    const m = new Map<string, number>()
    for (const o of obligaciones) {
      if (o.saldo_inicial == null || o.tipo === 'cadena') continue
      const desde = o.fecha_saldo ?? '1900-01-01'
      const abonos = movimientos
        .filter((x) => x.tipo === 'gasto' && x.obligacion_id === o.id && x.fecha >= desde && x.fecha <= fin)
        .reduce((s, x) => s + Number(x.abono_capital ?? x.valor), 0)
      m.set(o.id, Math.max(0, Number(o.saldo_inicial) - abonos))
    }
    return m
  }, [obligaciones, movimientos, origen])

  const grupos = (['credito', 'fijo', 'variable'] as ClaseGasto[])
    .map((c) => ({ c, items: filas.filter((f) => f.origen.clase_gasto === c) }))
    .filter((x) => x.items.length)

  async function confirmar() {
    if (invalido || destinoCerrado) return
    if (!filas.length && !copiaIngresos) return toast.error('No hay nada para clonar con estas opciones')
    setGuardando(true)
    try {
      const r = await clonarPlan(destino, filas, ingresosOrigen, ingresosDestino, op.ingresos)
      toast.success(`Plan de ${nombreMes(destino)} creado`, {
        description: `${r.compromisos} compromiso(s)${r.ingresos ? ` y ${r.ingresos} ingreso(s) esperado(s)` : ''} clonados de ${nombreMes(origen)}.`,
      })
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo clonar el plan', { description: (e as Error).message })
    } finally {
      setGuardando(false)
    }
  }

  const sw = (k: keyof OpcionesClonar, label: string, ayuda?: string) => (
    <label className="flex items-start gap-2 text-sm">
      <Switch checked={op[k]} onCheckedChange={(v) => setOp((x) => ({ ...x, [k]: v }))} className="mt-0.5" />
      <span>
        <span className="font-medium">{label}</span>
        {ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}
      </span>
    </label>
  )

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      ancho="lg"
      title="Clonar plan de un mes a otro"
      description="Copia los compromisos al mes destino. Nada se crea hasta que confirmes."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando || invalido || destinoCerrado || (!filas.length && !copiaIngresos)}>
            <Copy /> {guardando ? 'Clonando…' : `Clonar ${filas.length} compromiso(s)`}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="cl-origen" className="text-xs text-muted-foreground">
              De (mes origen)
            </Label>
            <Input id="cl-origen" type="month" value={origen.slice(0, 7)} onChange={(e) => e.target.value && setOrigen(`${e.target.value}-01`)} />
          </div>
          <ArrowRight className="mb-2 size-4 text-muted-foreground" />
          <div className="grid gap-1">
            <Label htmlFor="cl-destino" className="text-xs text-muted-foreground">
              A (mes destino)
            </Label>
            <Input id="cl-destino" type="month" value={destino.slice(0, 7)} onChange={(e) => e.target.value && setDestino(`${e.target.value}-01`)} />
          </div>
        </div>
        {invalido && <p className="text-xs text-rose-600">Elige dos meses distintos.</p>}
        {destinoCerrado && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600">
            <Lock className="size-3" /> {nombreMes(destino)} está cerrado: reábrelo para clonar.
          </p>
        )}

        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
          {sw('credito', 'Créditos', 'Cuotas de préstamos, tarjetas y compras a cuotas')}
          {sw('arrastrar', 'Arrastrar saldos no pagados', 'A cada crédito se le suma lo que quedó sin pagar en el mes origen')}
          {sw('fijo', 'Gastos fijos', 'Mismo valor del mes origen')}
          {sw('variable', 'Gastos variables', 'Con el valor del mes origen como estimado')}
          {sw('ingresos', 'Ingresos esperados', ingresosDestino.length ? 'El destino ya tiene ingresos: no se copian' : 'Si el destino no tiene')}
        </div>

        {grupos.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {gastos.some((g) => g.periodo === origen) ? 'Con estas opciones no hay compromisos para clonar.' : `${nombreMes(origen)} no tiene plan.`}
          </p>
        )}

        {grupos.map(({ c, items }) => (
          <div key={c} className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 text-xs">
              <BadgeClase clase={c} />
              <span className="text-muted-foreground">{items.length} compromiso(s)</span>
              <span className="ml-auto font-semibold tabular-nums">{money(items.reduce((s, f) => s + f.valor, 0))}</span>
            </div>
            <ul className="max-h-48 divide-y overflow-y-auto text-sm">
              {items.map((f) => (
                <li key={f.origen.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.origen.descripcion}</span>
                    {f.origen.obligacion_id && saldoDeuda.has(f.origen.obligacion_id) && (
                      <span className="block text-[11px] text-muted-foreground">Saldo de la deuda al cierre de {nombreMes(origen)}: {money(saldoDeuda.get(f.origen.obligacion_id))}</span>
                    )}
                  </span>
                  {f.arrastre > 0 && (
                    <span className="text-right text-[11px] text-rose-600 tabular-nums dark:text-rose-400">
                      {money(f.base)} + {money(f.arrastre)} sin pagar
                    </span>
                  )}
                  <span className="w-28 text-right font-medium tabular-nums">{money(f.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {(filas.length > 0 || copiaIngresos) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm">
            <span>
              Plan de {nombreMes(destino)}: <b className="tabular-nums">{money(total)}</b>
              {totalArrastre > 0 && <span className="text-rose-600 dark:text-rose-400"> (incluye {money(totalArrastre)} arrastrados)</span>}
            </span>
            {copiaIngresos && <span className="text-xs text-muted-foreground">+ ingreso esperado {money(ingresosOrigen.reduce((s, i) => s + Number(i.valor), 0))}</span>}
          </div>
        )}

        {saltados.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setVerSaltados((v) => !v)}>
              <ChevronDown className={cn('size-3.5 transition', verSaltados && 'rotate-180')} /> {saltados.length} no se clonan
            </button>
            {verSaltados && (
              <ul className="mt-1 grid gap-0.5 pl-5">
                {saltados.map(({ g, motivo }) => (
                  <li key={g.id}>
                    {g.descripcion} · <span className="italic">{motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
