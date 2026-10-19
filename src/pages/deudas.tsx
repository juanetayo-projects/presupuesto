import { useEffect, useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { ChevronDown, HandCoins, Landmark, Pencil, PiggyBank, Plus, Scissors, Trash2, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { KpiCard } from '@/components/kpi-card'
import { limpiarDominio, MarcaIcono } from '@/components/marca-icono'
import { MetasSeccion } from '@/components/metas'
import { ResponsableBadge } from '@/components/responsable-badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from '@/components/money-input'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { eliminarObligacion, guardarConcepto, guardarObligacion } from '@/lib/api'
import { diasHasta, fechaCorta, fechaLarga, money, pct, proximaFechaDia } from '@/lib/format'
import { TIPOS_OBLIGACION, type ObligacionVista, type TipoObligacion } from '@/lib/types'
import { cn } from '@/lib/utils'

export function DeudasPage() {
  const { obligaciones, config } = useData()
  const [editando, setEditando] = useState<ObligacionVista | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [persona, setPersona] = useState('todos')

  const visibles = obligaciones.filter((o) => persona === 'todos' || (o.responsable || 'Familiar') === persona)
  const deudas = visibles.filter((o) => o.tipo !== 'cadena')
  const ahorros = visibles.filter((o) => o.tipo === 'cadena')
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

      <ToggleGroup type="single" variant="outline" size="sm" value={persona} onValueChange={(v) => setPersona(v || 'todos')} className="w-full sm:w-auto">
        {['todos', ...config.responsables].map((r) => (
          <ToggleGroupItem key={r} value={r} className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:flex-none">
            {r === 'todos' ? 'Todas' : r === 'Familiar' ? 'Familiares' : r}
            <span className="ml-1 text-[10px] opacity-70">
              ({obligaciones.filter((o) => r === 'todos' || (o.responsable || 'Familiar') === r).length})
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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

/** Color de acento por tipo de obligación (misma paleta validada de las categorías). */
const COLOR_TIPO: Record<TipoObligacion, string> = {
  prestamo: '#2a78d6',
  tarjeta: '#6250d6',
  credito_cuotas: '#eb6834',
  cadena: '#008300',
  otro: '#64748b',
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
    <Card
      className={cn('gap-3 border-l-4 shadow-md', !o.activo && 'opacity-60')}
      style={{
        borderLeftColor: COLOR_TIPO[o.tipo],
        background: `linear-gradient(135deg, color-mix(in srgb, ${COLOR_TIPO[o.tipo]} 12%, var(--card)) 0%, var(--card) 60%)`,
        boxShadow: `0 4px 14px -6px color-mix(in srgb, ${COLOR_TIPO[o.tipo]} 45%, transparent)`,
      }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <MarcaIcono logo={o.logo} icono={o.tipo === 'cadena' ? 'users' : o.tipo === 'tarjeta' ? 'credit-card' : 'landmark'} color={COLOR_TIPO[o.tipo]} size="lg" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{o.nombre}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <ResponsableBadge nombre={o.responsable} />
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px]"
                style={{ color: COLOR_TIPO[o.tipo], borderColor: `color-mix(in srgb, ${COLOR_TIPO[o.tipo]} 45%, transparent)`, background: `color-mix(in srgb, ${COLOR_TIPO[o.tipo]} 12%, transparent)` }}
              >
                {TIPOS_OBLIGACION[o.tipo]}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              {o.entidad ?? '—'} · cuota {money(o.cuota)}
            </CardDescription>
            {o.tipo === 'tarjeta' && (
              <p className="mt-1 flex items-center gap-1 text-xs">
                <Scissors className="size-3 text-muted-foreground" />
                {o.dia_corte ? (
                  <>
                    Corte día <b>{o.dia_corte}</b>
                    <span className="text-muted-foreground">
                      · próximo {fechaCorta(proximaFechaDia(o.dia_corte))} ({diasHasta(proximaFechaDia(o.dia_corte)) === 0 ? 'hoy' : `en ${diasHasta(proximaFechaDia(o.dia_corte))}d`})
                    </span>
                  </>
                ) : (
                  <button className="text-primary underline-offset-2 hover:underline" onClick={onEdit}>
                    Registrar fecha de corte
                  </button>
                )}
              </p>
            )}
          </div>
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
  const { categorias, conceptos, config, recargar } = useData()
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
    logo: '',
    responsable: 'Familiar',
    dia_corte: '',
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
      logo: obligacion?.logo ?? '',
      responsable: obligacion?.responsable ?? 'Familiar',
      dia_corte: obligacion?.dia_corte?.toString() ?? '',
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
        logo: limpiarDominio(f.logo),
        responsable: f.responsable,
        dia_corte: f.dia_corte ? Math.min(31, Math.max(1, Number(f.dia_corte))) : null,
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
          logo: datos.logo,
          responsable: f.responsable,
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
      ancho="lg"
      title={obligacion ? `Editar ${obligacion.nombre}` : 'Nueva obligación'}
      description="Préstamo, tarjeta, compra a cuotas o cadena de ahorro."
      footerStart={
        obligacion && (
          <Button variant="destructive" onClick={borrar}>
            <Trash2 /> Eliminar
          </Button>
        )
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
        <CampoO label="Nombre" htmlFor="o-nombre">
          <Input id="o-nombre" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </CampoO>
        <CampoO label="Entidad / persona" htmlFor="o-entidad">
          <Input id="o-entidad" value={f.entidad} onChange={(e) => set('entidad', e.target.value)} />
        </CampoO>
        <CampoO label="¿A nombre de quién?" className="col-span-2 sm:col-span-1">
          <ToggleGroup type="single" variant="outline" size="sm" value={f.responsable} onValueChange={(v) => v && set('responsable', v)} className="h-8 w-full">
            {config.responsables.map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-8 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CampoO>

        <CampoO label="Tipo">
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
        </CampoO>
        <CampoO label={esCadena ? 'Aporte mensual' : 'Cuota mensual'} htmlFor="o-cuota">
          <MoneyInput id="o-cuota" value={f.cuota} onChange={(v) => set('cuota', v)} />
        </CampoO>
        <CampoO label={esCadena ? 'Aportado antes de la app' : 'Saldo actual'} htmlFor="o-saldo" className="col-span-2 sm:col-span-1">
          <MoneyInput id="o-saldo" value={f.saldo_inicial} onChange={(v) => set('saldo_inicial', v)} />
        </CampoO>

        {f.tipo === 'tarjeta' && (
          <CampoO label="Día de corte del extracto" htmlFor="o-corte">
            <Input id="o-corte" inputMode="numeric" placeholder="ej. 25" value={f.dia_corte} onChange={(e) => set('dia_corte', e.target.value.replace(/D/g, '').slice(0, 2))} />
          </CampoO>
        )}
        <CampoO label="Saldo con corte al" htmlFor="o-fsaldo">
          <Input id="o-fsaldo" type="date" value={f.fecha_saldo} onChange={(e) => set('fecha_saldo', e.target.value)} />
        </CampoO>
        {esCadena ? (
          <CampoO label="Mi turno de cobro" htmlFor="o-cobro" className="sm:col-span-2">
            <Input id="o-cobro" type="date" value={f.fecha_cobro} onChange={(e) => set('fecha_cobro', e.target.value)} />
          </CampoO>
        ) : (
          <>
            <CampoO label="Tasa mensual %" htmlFor="o-tasa">
              <Input id="o-tasa" inputMode="decimal" value={f.tasa_mensual} onChange={(e) => set('tasa_mensual', e.target.value.replace(',', '.'))} />
            </CampoO>
            <CampoO label="Cuotas restantes" htmlFor="o-ncuotas" className="col-span-2 sm:col-span-1">
              <Input id="o-ncuotas" inputMode="numeric" value={f.num_cuotas} onChange={(e) => set('num_cuotas', e.target.value.replace(/\D/g, ''))} />
            </CampoO>
          </>
        )}

        <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
          <MarcaIcono logo={f.logo} icono="landmark" color={COLOR_TIPO[f.tipo]} size="md" key={f.logo} />
          <CampoO label="Sitio web (logo)" htmlFor="o-logo" className="flex-1">
            <Input id="o-logo" placeholder="davivienda.com" value={f.logo} onChange={(e) => set('logo', e.target.value)} />
          </CampoO>
        </div>
        <CampoO label="Notas" htmlFor="o-notas" className="col-span-2">
          <Input id="o-notas" value={f.notas} onChange={(e) => set('notas', e.target.value)} />
        </CampoO>

        <label className="col-span-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm sm:col-span-1">
          <span>
            <b className="font-medium">Activa</b> <span className="text-xs text-muted-foreground">· desactívala al terminar de pagar</span>
          </span>
          <Switch checked={f.activo} onCheckedChange={(v) => set('activo', v)} />
        </label>
        {!obligacion && (
          <div className="col-span-2 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="flex-1">
              <b className="font-medium">Agregar a la plantilla mensual</b>{' '}
              <span className="text-xs text-muted-foreground">· crea el gasto recurrente con esta cuota</span>
            </span>
            {crearConcepto && <Input className="h-8 w-16" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} aria-label="Día límite" placeholder="Día" />}
            <Switch checked={crearConcepto} onCheckedChange={setCrearConcepto} />
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}

function CampoO({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
