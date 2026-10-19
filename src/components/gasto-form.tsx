import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from '@/components/money-input'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { actualizarGasto, crearGasto, eliminarGasto } from '@/lib/api'
import { fechaEnPeriodo, money, nombreMes, periodoMas } from '@/lib/format'
import { MEDIOS_PAGO, type Gasto } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  gasto?: Gasto | null
}

const NINGUNO = '__ninguno__'

export function GastoForm({ open, onOpenChange, gasto }: Props) {
  const { periodo, categorias, conceptos, obligaciones, config, recargar } = useData()
  const editando = Boolean(gasto)

  const [conceptoId, setConceptoId] = useState(NINGUNO)
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [medio, setMedio] = useState('Efectivo')
  const [valor, setValor] = useState(0)
  const [fecha, setFecha] = useState('')
  const [mes, setMes] = useState(periodo)
  const [obligacionId, setObligacionId] = useState(NINGUNO)
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
    setObligacionId(gasto?.obligacion_id ?? NINGUNO)
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
    setObligacionId(c.obligacion_id ?? NINGUNO)
    setResponsable(c.responsable ?? 'Familiar')
  }

  const resumenCuotas = useMemo(() => {
    if (!dividir || cuotas < 2) return null
    const total = modo === 'total' ? valor : valor * cuotas
    const porCuota = Math.round(total / cuotas)
    return { total, porCuota, hasta: nombreMes(periodoMas(mes, cuotas - 1)) }
  }, [dividir, cuotas, modo, valor, mes])

  async function guardar() {
    if (!descripcion.trim()) return toast.error('Escribe el concepto del gasto')
    if (!categoriaId) return toast.error('Elige una categoría')
    if (valor <= 0) return toast.error('El valor debe ser mayor a cero')
    setGuardando(true)
    try {
      const base = {
        periodo: mes,
        concepto_id: conceptoId === NINGUNO ? null : conceptoId,
        categoria_id: categoriaId,
        obligacion_id: obligacionId === NINGUNO ? null : obligacionId,
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
      title={editando ? 'Editar gasto' : 'Nuevo gasto'}
      description={editando && gasto?.cuotas_total ? `Cuota ${gasto.cuota_num} de ${gasto.cuotas_total}` : 'Cualquier gasto del mes, fijo o eventual.'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-1">
        {!editando && (
          <div className="grid gap-1.5">
            <Label>Desde la plantilla (opcional)</Label>
            <Select value={conceptoId} onValueChange={elegirConcepto}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>Otro concepto / gasto nuevo</SelectItem>
                {conceptos
                  .filter((c) => c.activo)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="g-desc">Concepto</Label>
          <Input id="g-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Matrícula colegio, SOAT, regalo…" />
        </div>

        <div className="grid gap-1.5">
          <Label>¿De quién es el gasto?</Label>
          <ToggleGroup type="single" variant="outline" size="sm" value={responsable} onValueChange={(v) => v && setResponsable(v)} className="w-full">
            {config.responsables.map((r) => (
              <ToggleGroupItem key={r} value={r} className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="g-valor">{dividir && modo === 'cuota' ? 'Valor por cuota' : 'Valor'}</Label>
            <MoneyInput id="g-valor" value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-mes">Mes</Label>
            <Input id="g-mes" type="month" value={mes.slice(0, 7)} onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Categoría</Label>
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
          </div>
          <div className="grid gap-1.5">
            <Label>Medio de pago</Label>
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
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="g-fecha">Fecha límite de pago</Label>
            <Input id="g-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Préstamo / deuda</Label>
            <Select value={obligacionId} onValueChange={setObligacionId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>No aplica</SelectItem>
                {obligaciones.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!editando && (
          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Dividir en varios meses</p>
                <p className="text-xs text-muted-foreground">Crea una cuota por mes desde el mes elegido.</p>
              </div>
              <Switch checked={dividir} onCheckedChange={setDividir} />
            </div>
            {dividir && (
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="g-cuotas">Número de cuotas</Label>
                    <Input id="g-cuotas" type="number" inputMode="numeric" min={2} max={60} value={cuotas} onChange={(e) => setCuotas(Math.max(2, Math.min(60, Number(e.target.value) || 2)))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>El valor digitado es</Label>
                    <ToggleGroup type="single" variant="outline" size="sm" value={modo} onValueChange={(v) => v && setModo(v as 'total' | 'cuota')} className="w-full">
                      <ToggleGroupItem value="total" className="flex-1">Total</ToggleGroupItem>
                      <ToggleGroupItem value="cuota" className="flex-1">Por cuota</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
                {resumenCuotas && (
                  <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                    {cuotas} cuotas de <b className="text-foreground">{money(resumenCuotas.porCuota)}</b> · total {money(resumenCuotas.total)} · hasta{' '}
                    {resumenCuotas.hasta}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="g-notas">Notas</Label>
          <Textarea id="g-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>

        {editando && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="destructive" size="sm" onClick={() => borrar(false)}>
              Eliminar este gasto
            </Button>
            {gasto?.grupo_cuotas && (
              <Button variant="outline" size="sm" onClick={() => borrar(true)}>
                Eliminar cuotas pendientes del grupo
              </Button>
            )}
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
