import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategoryIcon, ICONOS } from '@/components/category-icon'
import { limpiarDominio, MarcaIcono } from '@/components/marca-icono'
import { IngresosCard } from '@/components/ingresos'
import { BadgeClase } from '@/components/clonar-plan'
import { MoneyInput } from '@/components/money-input'
import { NUEVA_DEUDA, ObligacionSelect, resolverObligacion, SIN_DEUDA, TipoDeudaSelect } from '@/components/obligacion-select'
import { ResponsableBadge } from '@/components/responsable-badge'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { agregarMiembro, eliminarCategoria, eliminarConcepto, eliminarMiembro, guardarCategoria, guardarConcepto, guardarConfig } from '@/lib/api'
import { mesCorto, money } from '@/lib/format'
import { CLASES, MEDIOS_PAGO, type ClaseCategoria, type Concepto, type TipoObligacion, CLASES_GASTO, type ClaseGasto } from '@/lib/types'
import { cn } from '@/lib/utils'

const GRIS_OTROS = "#94a3b8"
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

export function AjustesPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Ajustes</h2>
      <Tabs defaultValue="ingresos">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="plantilla">Plantilla</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="miembros">Familia</TabsTrigger>
        </TabsList>
        <TabsContent value="ingresos" className="mt-4">
          <Ingresos />
        </TabsContent>
        <TabsContent value="plantilla" className="mt-4">
          <Plantilla />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <Categorias />
        </TabsContent>
        <TabsContent value="alertas" className="mt-4">
          <Alertas />
        </TabsContent>
        <TabsContent value="miembros" className="mt-4">
          <Miembros />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Ingresos() {
  const { config, recargar } = useData()
  const [base, setBase] = useState(config.ingresoBase)
  useEffect(() => setBase(config.ingresoBase), [config.ingresoBase])

  async function guardarBase() {
    try {
      await guardarConfig('ingreso_base', base)
      toast.success('Ingreso base actualizado')
      await recargar()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <IngresosCard />
      <Card>
        <CardHeader>
          <CardTitle>Ingreso base mensual</CardTitle>
          <CardDescription>Se agrega automáticamente al generar un mes que no tenga ingresos.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <MoneyInput value={base} onChange={setBase} className="flex-1" />
          <Button onClick={guardarBase}>Guardar</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Plantilla() {
  const { conceptos, categorias, recargar } = useData()
  const [editando, setEditando] = useState<Partial<Concepto> | null>(null)
  const [nuevaCat, setNuevaCat] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const visibles = conceptos.filter((c) => verInactivos || c.activo)
  const totalRecurrente = conceptos.filter((c) => c.activo && c.recurrente).reduce((s, c) => s + Number(c.valor_base), 0)

  async function crearCategoria() {
    try {
      await guardarCategoria({ nombre: nuevaCat.trim(), color: COLORES[categorias.length % 8], orden: categorias.length + 1 })
      setNuevaCat('')
      toast.success('Categoría creada')
      await recargar()
    } catch (e) {
      toast.error('No se pudo crear', { description: (e as Error).message })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Categorías e ítems de gasto</CardTitle>
          <CardDescription>
            Plantilla con la que se genera cada mes · total recurrente {money(totalRecurrente)}. Los cambios no modifican meses ya creados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input placeholder="Nueva categoría (ej. Mascotas)" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} className="min-w-48 flex-1" />
          <Button variant="outline" disabled={!nuevaCat.trim()} onClick={crearCategoria}>
            <Plus /> Crear categoría
          </Button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={verInactivos} onCheckedChange={setVerInactivos} /> Ver inactivos
          </label>
        </CardContent>
      </Card>

      {categorias.map((cat) => {
        const items = visibles.filter((c) => c.categoria_id === cat.id)
        const subtotal = items.filter((c) => c.activo && c.recurrente).reduce((s, c) => s + Number(c.valor_base), 0)
        return (
          <Card key={cat.id} className="gap-2 py-4">
            <div className="flex items-center gap-2 px-4">
              <CategoryIcon icono={cat.icono} color={cat.color} size="sm" />
              <p className="flex-1 truncate text-sm font-semibold">{cat.nombre}</p>
              <span className="text-sm font-medium tabular-nums">{money(subtotal)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditando({ recurrente: true, activo: true, categoria_id: cat.id, valor_base: 0, medio_pago: 'Efectivo' })}
              >
                <Plus /> Ítem
              </Button>
            </div>
            <div className="px-2">
              {items.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Sin ítems todavía.</p>}
              {items.map((c) => (
                <button key={c.id} onClick={() => setEditando(c)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60">
                  <MarcaIcono logo={c.logo} icono={c.icono ?? cat.icono} color={cat.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-medium', !c.activo && 'text-muted-foreground line-through')}>{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.medio_pago ?? '—'} · {c.dia_limite ? `día ${c.dia_limite}` : 'sin día límite'}
                    </p>
                  </div>
                  <ResponsableBadge nombre={c.responsable} />
                  {c.hasta_periodo && <Badge variant="outline">hasta {mesCorto(c.hasta_periodo)}</Badge>}
                  {!c.recurrente && c.activo && <Badge variant="outline">Eventual</Badge>}
                  {c.activo && <BadgeClase clase={c.clase_gasto ?? 'variable'} />}
                  {!c.activo && <Badge variant="secondary">Inactivo</Badge>}
                  {c.activo && Number(c.valor_base) === 0 && <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">Definir valor</Badge>}
                  <span className="text-sm font-medium tabular-nums">{money(c.valor_base)}</span>
                  <Pencil className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </Card>
        )
      })}
      <ConceptoForm concepto={editando} onClose={() => setEditando(null)} />
    </div>
  )
}

function ConceptoForm({ concepto, onClose }: { concepto: Partial<Concepto> | null; onClose: () => void }) {
  const { categorias, config, gastos, obligaciones, recargar } = useData()
  const [c, setC] = useState<Partial<Concepto>>({})
  const [obl, setObl] = useState(SIN_DEUDA)
  const [tipoNueva, setTipoNueva] = useState<TipoObligacion>('tarjeta')
  useEffect(() => {
    setC(concepto ?? {})
    setObl(concepto?.obligacion_id ?? SIN_DEUDA)
    setTipoNueva('tarjeta')
  }, [concepto])
  const set = <K extends keyof Concepto>(k: K, v: Concepto[K]) => setC((x) => ({ ...x, [k]: v }))
  const cat = categorias.find((k) => k.id === c.categoria_id)
  const usos = c.id ? gastos.filter((g) => g.concepto_id === c.id).length : 0
  // Con una deuda (que no sea una cadena de ahorro) el ítem es un crédito
  const tipoDeuda = obl === NUEVA_DEUDA ? tipoNueva : obligaciones.find((o) => o.id === obl)?.tipo
  const esCredito = obl !== SIN_DEUDA && tipoDeuda !== 'cadena'

  async function guardar() {
    if (!c.nombre?.trim() || !c.categoria_id) return toast.error('Nombre y categoría son obligatorios')
    try {
      const obligacion_id = await resolverObligacion(obl, {
        nombre: c.nombre.trim(),
        tipo: tipoNueva,
        medio: c.medio_pago ?? null,
        cuota: Number(c.valor_base ?? 0),
        responsable: c.responsable ?? 'Familiar',
      })
      await guardarConcepto({
        id: c.id,
        nombre: c.nombre.trim(),
        categoria_id: c.categoria_id,
        obligacion_id,
        medio_pago: c.medio_pago ?? null,
        valor_base: Number(c.valor_base ?? 0),
        dia_limite: c.dia_limite || null,
        recurrente: c.recurrente ?? true,
        activo: c.activo ?? true,
        notas: c.notas ?? null,
        responsable: c.responsable ?? 'Familiar',
        logo: limpiarDominio(c.logo),
        icono: c.icono || null,
        hasta_periodo: c.hasta_periodo || null,
        clase_gasto: esCredito ? 'credito' : c.clase_gasto === 'credito' || !c.clase_gasto ? 'variable' : c.clase_gasto,
      })
      toast.success(obl === NUEVA_DEUDA ? 'Ítem y deuda creados' : 'Ítem guardado')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }

  async function borrar() {
    if (!c.id) return
    const msg = usos
      ? `"${c.nombre}" se usa en ${usos} gasto(s). Se quitará de la plantilla (los gastos ya registrados se conservan). ¿Continuar?`
      : `¿Eliminar "${c.nombre}" de la plantilla?`
    if (!window.confirm(msg)) return
    try {
      await eliminarConcepto(c.id)
      toast.success('Ítem eliminado de la plantilla')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo eliminar', { description: (e as Error).message })
    }
  }

  return (
    <ResponsiveModal
      open={Boolean(concepto)}
      onOpenChange={(v) => !v && onClose()}
      ancho="lg"
      title={c.id ? 'Editar ítem de la plantilla' : 'Nuevo ítem'}
      footerStart={
        c.id && (
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
        <CampoA label="Nombre" htmlFor="c-nombre" className="col-span-2">
          <Input id="c-nombre" value={c.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} />
        </CampoA>
        <CampoA label="¿De quién es el gasto?" className="col-span-2 sm:col-span-1">
          <ToggleGroup type="single" variant="outline" size="sm" value={c.responsable ?? 'Familiar'} onValueChange={(v) => v && set('responsable', v)} className="h-8 w-full">
            {config.responsables.map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-8 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CampoA>

        <CampoA label="Categoría">
          <Select value={c.categoria_id} onValueChange={(v) => set('categoria_id', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  <span className="size-2 rounded-full" style={{ background: k.color }} />
                  {k.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoA>
        <CampoA label="Medio de pago">
          <Select value={c.medio_pago ?? 'Efectivo'} onValueChange={(v) => set('medio_pago', v)}>
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
        </CampoA>
        <CampoA label="Préstamo / deuda" className="col-span-2 sm:col-span-1">
          <ObligacionSelect value={obl} onChange={setObl} />
        </CampoA>

        {obl === NUEVA_DEUDA && (
          <div className="col-span-2 grid grid-cols-[1fr_auto] items-end gap-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 sm:col-span-3 sm:grid-cols-[1fr_1fr]">
            <p className="text-xs text-muted-foreground">
              Se creará la deuda <b className="text-foreground">{c.nombre?.trim() || '(escribe el nombre)'}</b> a nombre de{' '}
              <b className="text-foreground">{c.responsable ?? 'Familiar'}</b>.
            </p>
            <CampoA label="Tipo de deuda">
              <TipoDeudaSelect value={tipoNueva} onChange={setTipoNueva} />
            </CampoA>
          </div>
        )}

        <CampoA label="Tipo (fijo, variable o crédito)" className="col-span-2 sm:col-span-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={esCredito ? 'credito' : (c.clase_gasto ?? 'variable')} onValueChange={(v) => v && set('clase_gasto', v as ClaseGasto)} className="h-8 w-full">
            {(Object.keys(CLASES_GASTO) as ClaseGasto[]).map((k) => (
              <ToggleGroupItem key={k} value={k} title={CLASES_GASTO[k].ayuda} className="h-8 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {CLASES_GASTO[k].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CampoA>
        <CampoA label="Valor mensual" htmlFor="c-valor">
          <MoneyInput id="c-valor" value={Number(c.valor_base ?? 0)} onChange={(v) => set('valor_base', v)} />
        </CampoA>
        <CampoA label="Día límite de pago" htmlFor="c-dia">
          <Input id="c-dia" inputMode="numeric" value={c.dia_limite ?? ''} onChange={(e) => set('dia_limite', Math.min(31, Number(e.target.value.replace(/\D/g, ''))) || null)} />
        </CampoA>
        <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={c.recurrente ?? true} onCheckedChange={(v) => set('recurrente', v)} /> Recurrente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={c.activo ?? true} onCheckedChange={(v) => set('activo', v)} /> Activo
          </label>
        </div>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
          <MarcaIcono logo={c.logo} icono={c.icono ?? cat?.icono} color={cat?.color ?? '#64748b'} size="md" key={`${c.logo}-${c.icono}`} />
          <CampoA label="Sitio web (logo)" htmlFor="c-logo" className="flex-1">
            <Input id="c-logo" placeholder="claro.com.co" value={c.logo ?? ''} onChange={(e) => set('logo', e.target.value)} />
          </CampoA>
        </div>
        <CampoA label="Icono (si no hay logo)">
          <Select value={c.icono ?? 'circle'} onValueChange={(v) => set('icono', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ICONOS).map(([k, Icon]) => (
                <SelectItem key={k} value={k}>
                  <Icon /> {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoA>
        <CampoA label="Último mes (si termina)" htmlFor="c-hasta">
          <Input
            id="c-hasta"
            type="month"
            value={c.hasta_periodo?.slice(0, 7) ?? ''}
            onChange={(e) => set('hasta_periodo', e.target.value ? `${e.target.value}-01` : null)}
          />
        </CampoA>
        <CampoA label="Notas" htmlFor="c-notas" className="col-span-2 sm:col-span-3">
          <Input id="c-notas" value={c.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
        </CampoA>
      </div>
    </ResponsiveModal>
  )
}

function CampoA({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}


function Categorias() {
  const { categorias, recargar } = useData()
  const [nombre, setNombre] = useState('')
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await recargar()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }
  const guardar = (c: { id?: string; nombre: string; color: string; orden?: number; icono?: string; clase?: ClaseCategoria }) => run(() => guardarCategoria(c))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorías</CardTitle>
        <CardDescription>
          Nombre, clase para la regla 50/30/20, icono y color de cada categoría. Los 8 colores están validados para daltonismo; el gris se reserva para “Otros”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {categorias.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <CategoryIcon icono={c.icono} color={c.color} size="sm" />
            <Input
              defaultValue={c.nombre}
              aria-label="Nombre de la categoría"
              className="h-8 min-w-36 flex-1"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== c.nombre) guardar({ id: c.id, nombre: v, color: c.color }).then(() => toast.success('Categoría renombrada'))
              }}
            />
            <Select value={c.clase} onValueChange={(v) => guardar({ id: c.id, nombre: c.nombre, color: c.color, clase: v as ClaseCategoria })}>
              <SelectTrigger size="sm" className="w-40" aria-label="Clase 50/30/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLASES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label} ({v.meta}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={c.icono} onValueChange={(v) => guardar({ id: c.id, nombre: c.nombre, color: c.color, icono: v })}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ICONOS).map(([k, Icon]) => (
                  <SelectItem key={k} value={k}>
                    <Icon /> {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {[...COLORES, GRIS_OTROS].map((col) => (
                <button
                  key={col}
                  aria-label={`Color ${col}`}
                  onClick={() => guardar({ id: c.id, nombre: c.nombre, color: col })}
                  className="size-5 rounded-full ring-offset-2 ring-offset-background data-[on=true]:ring-2 data-[on=true]:ring-foreground"
                  data-on={c.color === col}
                  style={{ background: col }}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Eliminar categoría"
              onClick={() => window.confirm(`¿Eliminar la categoría ${c.nombre}?`) && run(() => eliminarCategoria(c.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Input placeholder="Nueva categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button
            variant="outline"
            disabled={!nombre.trim()}
            onClick={async () => {
              await guardar({ nombre: nombre.trim(), color: COLORES[categorias.length % COLORES.length], orden: categorias.length + 1 })
              setNombre('')
            }}
          >
            <Plus /> Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Alertas() {
  const { config, recargar } = useData()
  const [dias, setDias] = useState(config.diasAlerta)
  const [permiso, setPermiso] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de pago</CardTitle>
        <CardDescription>Se avisa de pagos vencidos, que vencen hoy y los próximos días.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="a-dias">Avisar con estos días de anticipación</Label>
            <Input id="a-dias" type="number" min={1} max={30} className="w-28" value={dias} onChange={(e) => setDias(Number(e.target.value) || 1)} />
          </div>
          <Button
            onClick={async () => {
              await guardarConfig('dias_alerta', dias)
              await recargar()
              toast.success('Anticipación actualizada')
            }}
          >
            Guardar
          </Button>
        </div>
        <div className="rounded-xl border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bell className="size-4" /> Notificaciones en este dispositivo
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Al abrir la app recibes un aviso (una vez al día) si hay pagos vencidos o para hoy. Instala la app en la pantalla de inicio del celular para tenerla a un toque.
          </p>
          {permiso === 'granted' ? (
            <Badge className="mt-2">Activadas</Badge>
          ) : permiso === 'unsupported' ? (
            <Badge variant="outline" className="mt-2">Este navegador no las admite</Badge>
          ) : (
            <Button size="sm" variant="outline" className="mt-2" onClick={async () => setPermiso(await Notification.requestPermission())}>
              Activar notificaciones
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Miembros() {
  const { miembros, recargar } = useData()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      await recargar()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros de la familia</CardTitle>
        <CardDescription>Sólo estos correos pueden ver y editar el presupuesto. Cada persona crea su cuenta con su propio correo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {miembros.map((m) => (
          <div key={m.email} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <span className="flex-1">
              <b className="font-medium">{m.nombre}</b> <span className="text-muted-foreground">{m.email}</span>
            </span>
            {miembros.length > 1 && (
              <Button variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => window.confirm(`¿Quitar a ${m.nombre}?`) && run(() => eliminarMiembro(m.email), 'Miembro retirado')}>
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="min-w-32 flex-1" />
          <Input placeholder="correo@ejemplo.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-48 flex-1" />
          <Button
            variant="outline"
            disabled={!email.includes('@') || !nombre}
            onClick={() =>
              run(async () => {
                await agregarMiembro(email, nombre)
                setEmail('')
                setNombre('')
              }, 'Miembro agregado')
            }
          >
            <Plus /> Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
