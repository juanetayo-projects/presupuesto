import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from '@/components/money-input'
import { SlidingTabs } from '@/components/motion'
import { NUEVA_DEUDA, ObligacionSelect, resolverObligacion, SIN_DEUDA } from '@/components/obligacion-select'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useAuth } from '@/context/auth'
import { useData } from '@/context/data'
import { eliminarMovimiento, guardarMovimiento } from '@/lib/api'
import { fechaCorta, hoyISO, money, nombreMes, periodoActual, periodoMas } from '@/lib/format'
import { MEDIOS_PAGO, TIPOS_INGRESO, type Movimiento } from '@/lib/types'
import { cn } from '@/lib/utils'

export type MovimientoPreset = Partial<Movimiento>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Con `id` se edita; sin `id` son valores iniciales de un movimiento nuevo. */
  movimiento?: MovimientoPreset | null
}

const SIN_COMPROMISO = '__ninguno__'

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

/**
 * Registrar lo REAL en un solo paso: un gasto que se pagó o un ingreso que se recibió.
 * El mes sale de la fecha. Un gasto puede enlazarse a un compromiso pendiente del plan (lo marca pagado).
 */
export function MovimientoForm({ open, onOpenChange, movimiento }: Props) {
  const { categorias, gastos, obligaciones, miembros, config, estadoMes, recargar } = useData()
  const { session } = useAuth()
  const yo = miembros.find((m) => m.email === session?.user.email)?.nombre ?? null
  const editando = Boolean(movimiento?.id)

  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto')
  const [valor, setValor] = useState(0)
  const [fecha, setFecha] = useState(hoyISO())
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [medio, setMedio] = useState('Efectivo')
  const [responsable, setResponsable] = useState('Familiar')
  const [compromiso, setCompromiso] = useState(SIN_COMPROMISO)
  const [obligacionId, setObligacionId] = useState(SIN_DEUDA)
  const [abono, setAbono] = useState<number | null>(null)
  const [tipoIngreso, setTipoIngreso] = useState('Salario')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    const m = movimiento ?? {}
    const otros = categorias.find((c) => c.nombre === 'Otros')
    setTipo(m.tipo ?? 'gasto')
    setValor(Number(m.valor ?? 0))
    setFecha(m.fecha ?? hoyISO())
    setCategoriaId(m.categoria_id ?? otros?.id ?? categorias[0]?.id ?? '')
    setDescripcion(m.descripcion ?? '')
    setMedio(m.medio_pago ?? 'Efectivo')
    setResponsable(m.responsable ?? 'Familiar')
    setCompromiso(m.gasto_id ?? SIN_COMPROMISO)
    setObligacionId(m.obligacion_id ?? SIN_DEUDA)
    setAbono(m.abono_capital ?? null)
    setTipoIngreso(m.tipo_ingreso ?? 'Salario')
    setNotas(m.notas ?? '')
  }, [open, movimiento, categorias])

  const periodo = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha.slice(0, 7)}-01` : periodoActual()
  const estado = fecha ? estadoMes(periodo) : 'actual'
  const cerrado = estado === 'cerrado' || (editando && movimiento?.periodo ? estadoMes(movimiento.periodo) === 'cerrado' : false)

  // Compromisos pendientes del plan que este gasto puede pagar: del mes anterior a dos meses después de la fecha.
  const pendientes = useMemo(() => {
    const desde = periodoMas(periodo, -1)
    const hasta = periodoMas(periodo, 2)
    return gastos
      .filter(
        (g) =>
          g.id === movimiento?.gasto_id ||
          (g.estado === 'pendiente' && g.periodo >= desde && g.periodo <= hasta && estadoMes(g.periodo) !== 'cerrado'),
      )
      .sort((a, b) => a.periodo.localeCompare(b.periodo) || (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'))
  }, [gastos, periodo, estadoMes, movimiento?.gasto_id])

  const elegirCompromiso = (id: string) => {
    setCompromiso(id)
    const g = gastos.find((x) => x.id === id)
    if (!g) return
    setCategoriaId(g.categoria_id)
    setDescripcion(g.descripcion)
    setMedio(g.medio_pago ?? 'Efectivo')
    setResponsable(g.responsable ?? 'Familiar')
    setObligacionId(g.obligacion_id ?? SIN_DEUDA)
    if (!valor) setValor(Number(g.valor_presupuestado))
  }

  const obligacion = obligacionId !== SIN_DEUDA && obligacionId !== NUEVA_DEUDA ? obligaciones.find((o) => o.id === obligacionId) : null

  async function guardar() {
    if (cerrado) return toast.error('El mes está cerrado', { description: 'Reábrelo desde Inicio o Histórico para registrar o modificar.' })
    if (valor <= 0) return toast.error('El valor debe ser mayor a cero')
    if (!fecha) return toast.error('Elige la fecha')
    if (!descripcion.trim()) return toast.error(tipo === 'gasto' ? 'Escribe en qué se gastó' : 'Escribe el concepto del ingreso')
    if (tipo === 'gasto' && !categoriaId) return toast.error('Elige una categoría')
    setGuardando(true)
    try {
      const esGasto = tipo === 'gasto'
      const obligacion_id = esGasto
        ? await resolverObligacion(obligacionId, { nombre: descripcion.trim(), tipo: 'tarjeta', medio, cuota: valor, responsable })
        : null
      await guardarMovimiento({
        id: movimiento?.id,
        tipo,
        fecha,
        valor,
        descripcion: descripcion.trim(),
        categoria_id: esGasto ? categoriaId : null,
        medio_pago: esGasto ? medio : null,
        responsable,
        gasto_id: esGasto && compromiso !== SIN_COMPROMISO ? compromiso : null,
        obligacion_id,
        abono_capital: esGasto && obligacion_id && abono ? abono : null,
        tipo_ingreso: esGasto ? null : tipoIngreso,
        pagado_por: movimiento?.pagado_por ?? yo,
        notas: notas.trim() || null,
      })
      toast.success(editando ? 'Movimiento actualizado' : esGasto ? `Gasto registrado en ${nombreMes(periodo)}` : `Ingreso registrado en ${nombreMes(periodo)}`)
      await recargar()
      onOpenChange(false)
    } catch (e) {
      const msg = (e as Error).message
      toast.error('No se pudo guardar', {
        description: /movimientos_un_pago_por_compromiso/.test(msg) ? 'Ese compromiso del plan ya tiene un pago registrado.' : msg,
      })
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!movimiento?.id) return
    const aviso = movimiento.gasto_id ? '\n\nEl compromiso del plan que pagaba volverá a quedar pendiente.' : ''
    if (!window.confirm(`¿Eliminar "${movimiento.descripcion}" por ${money(movimiento.valor)}?${aviso}`)) return
    try {
      await eliminarMovimiento(movimiento.id)
      toast.success('Movimiento eliminado')
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
      title={editando ? 'Editar movimiento' : 'Registrar movimiento'}
      description={fecha ? `Queda en ${nombreMes(periodo)} (según la fecha)` : undefined}
      footerStart={
        editando &&
        !cerrado && (
          <Button variant="destructive" onClick={borrar}>
            <Trash2 /> Eliminar
          </Button>
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
          <Lock className="size-3.5 shrink-0" /> {nombreMes(movimiento?.periodo ?? periodo)} está cerrado: sólo consulta.
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <SlidingTabs
            size="md"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'gasto', label: 'Gasto pagado' },
              { value: 'ingreso', label: 'Ingreso recibido' },
            ]}
          />
        </div>

        <Campo label="Valor" htmlFor="m-valor">
          <MoneyInput id="m-valor" value={valor} onChange={setValor} />
        </Campo>
        <Campo label="Fecha" htmlFor="m-fecha">
          <Input id="m-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo label={tipo === 'gasto' ? 'Categoría' : 'Tipo de ingreso'} className="col-span-2 sm:col-span-1">
          {tipo === 'gasto' ? (
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
          ) : (
            <Select value={tipoIngreso} onValueChange={setTipoIngreso}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_INGRESO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        <Campo label={tipo === 'gasto' ? '¿En qué se gastó?' : 'Concepto'} htmlFor="m-desc" className="col-span-2">
          <Input
            id="m-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === 'gasto' ? 'Ej. Mercado, taxi, droguería…' : 'Ej. Salario quincena, honorarios…'}
          />
        </Campo>
        {tipo === 'gasto' ? (
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
        ) : (
          <div className="hidden sm:block" />
        )}

        <Campo label={tipo === 'gasto' ? '¿De quién es el gasto?' : '¿Quién lo recibió?'} className="col-span-2 sm:col-span-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={responsable} onValueChange={(v) => v && setResponsable(v)} className="h-8 w-full">
            {config.responsables.map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-8 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Campo>

        {tipo === 'gasto' && (
          <>
            <Campo label="¿Paga un compromiso del plan? (opcional)" className="col-span-2">
              <Select value={compromiso} onValueChange={(v) => (v === SIN_COMPROMISO ? setCompromiso(v) : elegirCompromiso(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_COMPROMISO}>No, es un gasto aparte del plan</SelectItem>
                  {pendientes.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <CalendarCheck className="text-muted-foreground" />
                      {g.descripcion} · {nombreMes(g.periodo)}
                      {g.fecha_limite ? ` · vence ${fechaCorta(g.fecha_limite)}` : ''} · {money(g.valor_presupuestado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Préstamo / deuda que abona">
              <ObligacionSelect value={obligacionId} onChange={setObligacionId} />
            </Campo>
            {obligacion && obligacion.tipo !== 'cadena' && (
              <Campo label="Abono a capital (opcional)" htmlFor="m-abono" className="col-span-2 sm:col-span-3">
                <MoneyInput id="m-abono" value={abono} onChange={setAbono} placeholder="Vacío = todo el pago baja el saldo" />
              </Campo>
            )}
          </>
        )}

        <Campo label="Notas" htmlFor="m-notas" className="col-span-2 sm:col-span-3">
          <Input id="m-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </Campo>
      </div>
    </ResponsiveModal>
  )
}
