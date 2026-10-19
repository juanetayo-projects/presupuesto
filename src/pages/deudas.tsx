import { useEffect, useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { ChevronDown, HandCoins, Landmark, Pencil, PiggyBank, Plus, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { KpiCard } from '@/components/kpi-card'
import { MetasSeccion } from '@/components/metas'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from '@/components/money-input'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { eliminarObligacion, guardarConcepto, guardarObligacion } from '@/lib/api'
import { fechaCorta, fechaLarga, money, pct } from '@/lib/format'
import { TIPOS_OBLIGACION, type ObligacionVista, type TipoObligacion } from '@/lib/types'
import { cn } from '@/lib/utils'

export function DeudasPage() {
  const { obligaciones } = useData()
  const [editando, setEditando] = useState<ObligacionVista | null>(null)
  const [nuevo, setNuevo] = useState(false)

  const deudas = obligaciones.filter((o) => o.tipo !== 'cadena')
  const ahorros = obligaciones.filter((o) => o.tipo === 'cadena')
  const saldoTotal = deudas.reduce((s, o) => s + Number(o.saldo_actual ?? 0), 0)
  const cuotaTotal = deudas.filter((o) => o.activo).reduce((s, o) => s + Number(o.cuota ?? 0), 0)
  const pagadoTotal = deudas.reduce((s, o) => s + Number(o.total_pagado), 0)
  const ahorrado = ahorros.reduce((s, o) => s + Number(o.saldo_actual ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Préstamos, tarjetas y cadenas</h2>
          <p className="text-sm text-muted-foreground">Cada pago marcado en Gastos descuenta el saldo automáticamente.</p>
        </div>
        <Button size="sm" onClick={() => setNuevo(true)}>
          <Plus /> Nueva obligación
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard solid label="Saldo total adeudado" value={money(saldoTotal)} icon={Landmark} tone="bad" />
        <KpiCard label="Cuotas al mes" value={money(cuotaTotal)} icon={HandCoins} tone="warn" />
        <KpiCard label="Pagado a la fecha" value={money(pagadoTotal)} icon={TrendingDown} tone="good" />
        <KpiCard label="Ahorrado en cadenas" value={money(ahorrado)} icon={PiggyBank} tone="brand" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {deudas.map((o) => (
          <TarjetaObligacion key={o.id} o={o} onEdit={() => setEditando(o)} />
        ))}
      </div>

      {ahorros.length > 0 && (
        <>
          <h3 className="pt-2 text-sm font-semibold text-muted-foreground">Cadenas de ahorro</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ahorros.map((o) => (
              <TarjetaObligacion key={o.id} o={o} onEdit={() => setEditando(o)} />
            ))}
          </div>
        </>
      )}

      <Estrategia deudas={deudas.filter((o) => o.activo)} />

      <MetasSeccion />

      <ObligacionForm open={nuevo || Boolean(editando)} obligacion={editando} onClose={() => (setNuevo(false), setEditando(null))} />
    </div>
  )
}

/**
 * Orden sugerido para salir de deudas:
 * - Bola de nieve (Dave Ramsey): primero el saldo más pequeño → victorias rápidas.
 * - Avalancha: primero la tasa más alta → menos intereses pagados.
 * Se pagan los mínimos de todas y el dinero extra va a la primera de la lista.
 */
function Estrategia({ deudas }: { deudas: ObligacionVista[] }) {
  const [modo, setModo] = useState<'bola' | 'avalancha'>('bola')
  const conSaldo = deudas.filter((o) => Number(o.saldo_actual ?? 0) > 0)
  const orden = [...conSaldo].sort((a, b) =>
    modo === 'bola'
      ? Number(a.saldo_actual) - Number(b.saldo_actual)
      : Number(b.tasa_mensual ?? 0) - Number(a.tasa_mensual ?? 0) || Number(a.saldo_actual) - Number(b.saldo_actual),
  )
  const sinTasa = modo === 'avalancha' && conSaldo.some((o) => o.tasa_mensual == null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan para salir de deudas</CardTitle>
        <CardDescription>
          Paga el mínimo de todas y destina el dinero extra (imprevistos no usados, primas) a la primera de la lista. Al terminarla, su cuota pasa a la siguiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={modo} onValueChange={(v) => v && setModo(v as 'bola' | 'avalancha')}>
          <ToggleGroupItem value="bola">Bola de nieve (saldo menor)</ToggleGroupItem>
          <ToggleGroupItem value="avalancha">Avalancha (tasa mayor)</ToggleGroupItem>
        </ToggleGroup>
        {orden.length === 0 && <p className="text-sm text-muted-foreground">Registra el saldo actual de cada obligación para ver el plan.</p>}
        <ol className="space-y-1.5">
          {orden.map((o, i) => (
            <li key={o.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-sm', i === 0 && 'border-primary/50 bg-primary/5')}>
              <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold', i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{i + 1}</span>
              <span className="flex-1 truncate">{o.nombre}</span>
              {o.tasa_mensual != null && <span className="text-xs text-muted-foreground">{o.tasa_mensual}% m.v.</span>}
              <span className="font-medium tabular-nums">{money(o.saldo_actual)}</span>
            </li>
          ))}
        </ol>
        {sinTasa && <p className="text-xs text-muted-foreground">Algunas obligaciones no tienen tasa registrada; edítalas para que el orden por avalancha sea exacto.</p>}
      </CardContent>
    </Card>
  )
}

function TarjetaObligacion({ o, onEdit }: { o: ObligacionVista; onEdit: () => void }) {
  const { gastos } = useData()
  const [verPagos, setVerPagos] = useState(false)
  const pagos = useMemo(
    () => gastos.filter((g) => g.obligacion_id === o.id && g.estado === 'pagado').sort((a, b) => (b.fecha_pago ?? '').localeCompare(a.fecha_pago ?? '')),
    [gastos, o.id],
  )
  const esCadena = o.tipo === 'cadena'
  const saldo = o.saldo_actual
  const avance = o.saldo_inicial ? pct(Number(o.total_abonos), Number(o.saldo_inicial)) : 0
  const mesesRestantes = !esCadena && saldo && o.cuota ? Math.ceil(Number(saldo) / Number(o.cuota)) : null
  const fin = mesesRestantes ? format(addMonths(new Date(), mesesRestantes), 'MMM yyyy', { locale: es }) : null

  return (
    <Card className={cn('gap-3', !o.activo && 'opacity-60')}>
      <CardHeader>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{o.nombre}</CardTitle>
            <CardDescription>
              {o.entidad ?? '—'} · cuota {money(o.cuota)}
            </CardDescription>
          </div>
          <Badge variant={o.tipo === 'otro' ? 'outline' : 'secondary'}>{TIPOS_OBLIGACION[o.tipo]}</Badge>
          <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={onEdit}>
            <Pencil />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {esCadena ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Aportes acumulados</p>
              <p className="text-2xl font-semibold tabular-nums">{money(saldo)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {o.fecha_cobro ? `Turno de cobro: ${fechaLarga(o.fecha_cobro)}` : 'Registra la fecha de tu turno de cobro.'} · {o.cuotas_pagadas} aporte(s)
            </p>
          </>
        ) : saldo == null ? (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Falta el saldo actual. <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={onEdit}>Regístralo</button> para
            llevar el control de pagos y saldo.
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Saldo actual</p>
                <p className="text-2xl font-semibold tabular-nums">{money(saldo)}</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                de {money(o.saldo_inicial)}
                {o.fecha_saldo && <span className="block">al {fechaCorta(o.fecha_saldo)}</span>}
              </p>
            </div>
            <Progress value={avance} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Dato label="Abonado" value={`${avance.toFixed(0)}%`} />
              <Dato label="Cuotas" value={o.num_cuotas ? `${o.cuotas_pagadas}/${o.num_cuotas}` : String(o.cuotas_pagadas)} />
              <Dato label="Termina" value={fin ?? '—'} />
            </div>
          </>
        )}
        {o.notas && <p className="text-xs text-muted-foreground italic">{o.notas}</p>}
        <button className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground" onClick={() => setVerPagos(!verPagos)}>
          <ChevronDown className={cn('size-3.5 transition', verPagos && 'rotate-180')} /> Historial de pagos ({pagos.length})
        </button>
        {verPagos && (
          <ul className="space-y-1 text-xs">
            {pagos.length === 0 && <li className="text-muted-foreground">Sin pagos registrados.</li>}
            {pagos.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 tabular-nums">
                <span>{fechaCorta(p.fecha_pago)}</span>
                <span className="text-muted-foreground">{p.abono_capital ? `capital ${money(p.abono_capital)}` : ''}</span>
                <span className="font-medium">{money(p.valor_pagado)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold capitalize tabular-nums">{value}</p>
    </div>
  )
}

function ObligacionForm({ open, obligacion, onClose }: { open: boolean; obligacion: ObligacionVista | null; onClose: () => void }) {
  const { categorias, conceptos, recargar } = useData()
  const [f, setF] = useState({
    nombre: '',
    entidad: '',
    tipo: 'prestamo' as TipoObligacion,
    saldo_inicial: 0,
    fecha_saldo: '',
    cuota: 0,
    tasa_mensual: '',
    num_cuotas: '',
    fecha_cobro: '',
    activo: true,
    notas: '',
  })
  const [crearConcepto, setCrearConcepto] = useState(true)
  const [dia, setDia] = useState('5')

  useEffect(() => {
    if (!open) return
    setF({
      nombre: obligacion?.nombre ?? '',
      entidad: obligacion?.entidad ?? '',
      tipo: obligacion?.tipo ?? 'prestamo',
      saldo_inicial: Number(obligacion?.saldo_inicial ?? 0),
      fecha_saldo: obligacion?.fecha_saldo ?? '',
      cuota: Number(obligacion?.cuota ?? 0),
      tasa_mensual: obligacion?.tasa_mensual?.toString() ?? '',
      num_cuotas: obligacion?.num_cuotas?.toString() ?? '',
      fecha_cobro: obligacion?.fecha_cobro ?? '',
      activo: obligacion?.activo ?? true,
      notas: obligacion?.notas ?? '',
    })
    setCrearConcepto(!obligacion)
  }, [open, obligacion])

  async function guardar() {
    if (!f.nombre.trim()) return toast.error('Escribe el nombre')
    try {
      const datos = {
        id: obligacion?.id,
        nombre: f.nombre.trim(),
        entidad: f.entidad.trim() || null,
        tipo: f.tipo,
        saldo_inicial: f.saldo_inicial || null,
        fecha_saldo: f.fecha_saldo || null,
        cuota: f.cuota || null,
        tasa_mensual: f.tasa_mensual ? Number(f.tasa_mensual) : null,
        num_cuotas: f.num_cuotas ? Number(f.num_cuotas) : null,
        fecha_cobro: f.fecha_cobro || null,
        activo: f.activo,
        notas: f.notas.trim() || null,
      }
      const creada = await guardarObligacion(datos)
      if (creada && crearConcepto) {
        const cat = categorias.find((c) => c.nombre === (f.tipo === 'cadena' ? 'Ahorro' : 'Obligaciones financieras')) ?? categorias[0]
        await guardarConcepto({
          categoria_id: cat.id,
          obligacion_id: creada.id,
          nombre: creada.nombre,
          medio_pago: f.entidad || null,
          valor_base: f.cuota,
          dia_limite: Number(dia) || null,
          recurrente: true,
          orden: conceptos.length + 1,
        })
      }
      toast.success('Obligación guardada')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }

  async function borrar() {
    if (!obligacion || !window.confirm(`¿Eliminar ${obligacion.nombre}? Los gastos ya registrados se conservan.`)) return
    try {
      await eliminarObligacion(obligacion.id)
      toast.success('Obligación eliminada')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo eliminar', { description: (e as Error).message })
    }
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const esCadena = f.tipo === 'cadena'

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={obligacion ? `Editar ${obligacion.nombre}` : 'Nueva obligación'}
      description="Préstamo, tarjeta, compra a cuotas o cadena de ahorro."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-4 py-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="o-nombre">Nombre</Label>
            <Input id="o-nombre" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-entidad">Entidad / persona</Label>
            <Input id="o-entidad" value={f.entidad} onChange={(e) => set('entidad', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => set('tipo', v as TipoObligacion)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_OBLIGACION).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-cuota">{esCadena ? 'Aporte mensual' : 'Cuota mensual'}</Label>
            <MoneyInput id="o-cuota" value={f.cuota} onChange={(v) => set('cuota', v)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="o-saldo">{esCadena ? 'Aportado antes de usar la app' : 'Saldo actual'}</Label>
            <MoneyInput id="o-saldo" value={f.saldo_inicial} onChange={(v) => set('saldo_inicial', v)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-fsaldo">Saldo con corte al</Label>
            <Input id="o-fsaldo" type="date" value={f.fecha_saldo} onChange={(e) => set('fecha_saldo', e.target.value)} />
          </div>
        </div>
        {esCadena ? (
          <div className="grid gap-1.5">
            <Label htmlFor="o-cobro">Fecha de mi turno de cobro</Label>
            <Input id="o-cobro" type="date" value={f.fecha_cobro} onChange={(e) => set('fecha_cobro', e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="o-tasa">Tasa mensual %</Label>
              <Input id="o-tasa" inputMode="decimal" value={f.tasa_mensual} onChange={(e) => set('tasa_mensual', e.target.value.replace(',', '.'))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-ncuotas">Cuotas restantes</Label>
              <Input id="o-ncuotas" inputMode="numeric" value={f.num_cuotas} onChange={(e) => set('num_cuotas', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="o-notas">Notas</Label>
          <Textarea id="o-notas" rows={2} value={f.notas} onChange={(e) => set('notas', e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">Activa</p>
            <p className="text-xs text-muted-foreground">Desactívala cuando termines de pagarla.</p>
          </div>
          <Switch checked={f.activo} onCheckedChange={(v) => set('activo', v)} />
        </div>
        {!obligacion && (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Agregar a la plantilla mensual</p>
              <p className="text-xs text-muted-foreground">Crea el gasto recurrente con esta cuota.</p>
            </div>
            {crearConcepto && <Input className="w-20" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} aria-label="Día límite" placeholder="Día" />}
            <Switch checked={crearConcepto} onCheckedChange={setCrearConcepto} />
          </div>
        )}
        {obligacion && (
          <Button variant="destructive" size="sm" className="justify-self-start" onClick={borrar}>
            Eliminar obligación
          </Button>
        )}
      </div>
    </ResponsiveModal>
  )
}
