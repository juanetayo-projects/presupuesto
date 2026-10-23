import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Lock, Telescope, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from '@/components/money-input'
import { NUEVA_DEUDA, ObligacionSelect, resolverObligacion, SIN_DEUDA, TipoDeudaSelect } from '@/components/obligacion-select'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { actualizarGasto, crearGasto, eliminarGasto } from '@/lib/api'
import { fechaEnPeriodo, money, nombreMes, periodoMas } from '@/lib/format'
import { MEDIOS_PAGO, type Gasto, type TipoObligacion } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  gasto?: Gasto | null
}

const NINGUNO = '__ninguno__'

/** Campo compacto: etiqueta pequeña + control. */
function Campo({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

export function GastoForm({ open, onOpenChange, gasto }: Props) {
  const { periodo, categorias, conceptos, config, recargar, estadoMes } = useData()
  const editando = Boolean(gasto)

  const [conceptoId, setConceptoId] = useState(NINGUNO)
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [medio, setMedio] = useState('Efectivo')
  const [valor, setValor] = useState(0)
  const [fecha, setFecha] = useState('')
  const [mes, setMes] = useState(periodo)
  const [obligacionId, setObligacionId] = useState(SIN_DEUDA)
  const [tipoNueva, setTipoNueva] = useState<TipoObligacion>('tarjeta')
  const [notas, setNotas] = useState('')
  const [responsable, setResponsable] = useState('Familiar')
  const [dividir, setDividir] = useState(false)
  const [cuotas, setCuotas] = useState(3)
  const [modo, setModo] = useState<'total' | 'cuota'>('total')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    const otros = categorias.find((c) => c.nombre === 'Otros')
    setConceptoId(gasto?.concepto_id ?? NINGUNO)
    setDescripcion(gasto?.descripcion ?? '')
    setCategoriaId(gasto?.categoria_id ?? otros?.id ?? categorias[0]?.id ?? '')
    setMedio(gasto?.medio_pago ?? 'Efectivo')
    setValor(Number(gasto?.valor_presupuestado ?? 0))
    setFecha(gasto?.fecha_limite ?? '')
    setMes(gasto?.periodo ?? periodo)
    setObligacionId(gasto?.obligacion_id ?? SIN_DEUDA)
    setTipoNueva('tarjeta')
    setNotas(gasto?.notas ?? '')
    setResponsable(gasto?.responsable ?? 'Familiar')
    setDividir(false)
    setCuotas(3)
    setModo('total')
  }, [open, gasto, periodo, categorias])

  const elegirConcepto = (id: string) => {
    setConceptoId(id)
    const c = conceptos.find((x) => x.id === id)
    if (!c) return
    setDescripcion(c.nombre)
    setCategoriaId(c.categoria_id)
    setMedio(c.medio_pago ?? 'Efectivo')
    setValor(Number(c.valor_base))
    setFecha(fechaEnPeriodo(mes, c.dia_limite) ?? '')
    setObligacionId(c.obligacion_id ?? SIN_DEUDA)
    setResponsable(c.responsable ?? 'Familiar')
  }

  const resumenCuotas = useMemo(() => {
    if (!dividir || cuotas < 2) return null
    const total = modo === 'total' ? valor : valor * cuotas
    const porCuota = Math.round(total / cuotas)
    return { total, porCuota, hasta: nombreMes(periodoMas(mes, cuotas - 1)) }
  }, [dividir, cuotas, modo, valor, mes])

  // Un mes cerrado no se modifica (la base también lo impide); en meses futuros el valor es un estimado a pagar.
  const cerrado = estadoMes(mes) === 'cerrado' || (gasto ? estadoMes(gasto.periodo) === 'cerrado' : false)
  const futuro = estadoMes(mes) === 'futuro'

  async function guardar() {
    if (cerrado) return toast.error('El mes está cerrado', { description: 'Reábrelo desde Inicio o Histórico para modificarlo.' })
    if (!descripcion.trim()) return toast.error('Escribe el concepto del gasto')
    if (!categoriaId) return toast.error('Elige una categoría')
    if (valor <= 0) return toast.error('El valor debe ser mayor a cero')
    setGuardando(true)
    try {
      const obligacion_id = await resolverObligacion(obligacionId, {
        nombre: descripcion.trim(),
        tipo: tipoNueva,
        medio,
        cuota: dividir && modo === 'total' ? Math.round(valor / cuotas) : valor,
        responsable,
      })
      const base = {
        periodo: mes,
        concepto_id: conceptoId === NINGUNO ? null : conceptoId,
        categoria_id: categoriaId,
        obligacion_id,
        descripcion: descripcion.trim(),
        medio_pago: medio,
        valor_presupuestado: valor,
        fecha_limite: fecha || null,
        notas: notas.trim() || null,
        responsable,
      }
      if (gasto) {
        await actualizarGasto(gasto.id, base)
        toast.success('Gasto actualizado')
      } else {
        await crearGasto(
          { ...base, estado: 'pendiente', valor_pagado: null, fecha_pago: null, abono_capital: null, pagado_por: null },
          dividir ? cuotas : 1,
          modo,
        )
        toast.success(dividir ? `Gasto dividido en ${cuotas} cuotas` : 'Gasto agregado')
      }
      if (obligacionId === NUEVA_DEUDA) toast.success(`Deuda "${descripcion.trim()}" creada. Registra su saldo en Deudas.`)
      await recargar()
      onOpenChange(false)
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(todo: boolean) {
    if (!gasto) return
    const msg = todo ? '¿Eliminar este gasto y todas sus cuotas pendientes?' : '¿Eliminar este gasto?'
    if (!window.confirm(msg)) return
    try {
      await eliminarGasto(gasto, todo)
      toast.success('Gasto eliminado')
      await recargar()
      onOpenChange(false)
    } catch (e) {
      toast.error('No se pudo eliminar', { description: (e as Error).message })
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      ancho="lg"
      title={editando ? 'Editar gasto' : 'Nuevo gasto'}
      description={editando && gasto?.cuotas_total ? `Cuota ${gasto.cuota_num} de ${gasto.cuotas_total}` : undefined}
      footerStart={
        editando && !cerrado && (
          <>
            <Button variant="destructive" onClick={() => borrar(false)}>
              <Trash2 /> Eliminar
            </Button>
            {gasto?.grupo_cuotas && (
              <Button variant="outline" onClick={() => borrar(true)}>
                Eliminar cuotas pendientes
              </Button>
            )}
          </>
        )
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || cerrado}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {cerrado && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-xs">
          <Lock className="size-3.5 shrink-0" /> {nombreMes(gasto?.periodo ?? mes)} está cerrado: sólo consulta. Reábrelo para modificar este gasto.
        </div>
      )}
      {futuro && !cerrado && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/8 px-3 py-2 text-xs text-violet-800 dark:text-violet-200">
          <Telescope className="size-3.5 shrink-0" /> {nombreMes(mes)} es un mes futuro: el valor se registra como <b>estimado a pagar</b>.
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
        {!editando && (
          <Campo label="Desde la plantilla (opcional)" className="col-span-2 sm:col-span-1">
            <Select value={conceptoId} onValueChange={elegirConcepto}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>Gasto nuevo</SelectItem>
                {conceptos
                  .filter((c) => c.activo)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Campo>
        )}
        <Campo label="Concepto" htmlFor="g-desc" className={editando ? 'col-span-2' : 'col-span-2'}>
          <Input id="g-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. NU Juank, SOAT, matrícula…" />
        </Campo>
        <Campo label="¿De quién es el gasto?" className={editando ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-3'}>
          <ToggleGroup type="single" variant="outline" size="sm" value={responsable} onValueChange={(v) => v && setResponsable(v)} className="h-8 w-full">
            {config.responsables.map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-8 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Campo>

        <Campo label={dividir && modo === 'cuota' ? 'Valor por cuota' : futuro ? 'Valor estimado' : 'Valor'} htmlFor="g-valor">
          <MoneyInput id="g-valor" value={valor} onChange={setValor} />
        </Campo>
        <Campo label="Mes" htmlFor="g-mes">
          <Input id="g-mes" type="month" value={mes.slice(0, 7)} onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)} />
        </Campo>
        <Campo label="Fecha límite de pago" htmlFor="g-fecha" className="col-span-2 sm:col-span-1">
          <Input id="g-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>

        <Campo label="Categoría">
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Medio de pago">
          <Select value={medio} onValueChange={setMedio}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIOS_PAGO.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Préstamo / deuda" className="col-span-2 sm:col-span-1">
          <ObligacionSelect value={obligacionId} onChange={setObligacionId} />
        </Campo>

        {obligacionId === NUEVA_DEUDA && (
          <div className="col-span-2 grid grid-cols-[1fr_auto] items-end gap-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 sm:col-span-3 sm:grid-cols-[1fr_1fr]">
            <p className="text-xs text-muted-foreground">
              Se creará la deuda <b className="text-foreground">{descripcion.trim() || '(escribe el concepto)'}</b> a nombre de{' '}
              <b className="text-foreground">{responsable}</b>, con logo según el medio de pago.
            </p>
            <Campo label="Tipo de deuda">
              <TipoDeudaSelect value={tipoNueva} onChange={setTipoNueva} />
            </Campo>
          </div>
        )}

        <Campo label="Notas" htmlFor="g-notas" className="col-span-2 sm:col-span-3">
          <Input id="g-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </Campo>

        {!editando && (
          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/40 px-3 py-2 sm:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={dividir} onCheckedChange={setDividir} /> Dividir en varios meses
            </label>
            {dividir && (
              <>
                <Input
                  aria-label="Número de cuotas"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={60}
                  className="h-8 w-16"
                  value={cuotas}
                  onChange={(e) => setCuotas(Math.max(2, Math.min(60, Number(e.target.value) || 2)))}
                />
                <span className="text-sm text-muted-foreground">cuotas · el valor es</span>
                <ToggleGroup type="single" variant="outline" size="sm" value={modo} onValueChange={(v) => v && setModo(v as 'total' | 'cuota')}>
                  <ToggleGroupItem value="total">Total</ToggleGroupItem>
                  <ToggleGroupItem value="cuota">Por cuota</ToggleGroupItem>
                </ToggleGroup>
                {resumenCuotas && (
                  <span className="basis-full text-xs text-muted-foreground">
                    {cuotas} cuotas de <b className="text-foreground">{money(resumenCuotas.porCuota)}</b> · total {money(resumenCuotas.total)} · hasta{' '}
                    {resumenCuotas.hasta}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
