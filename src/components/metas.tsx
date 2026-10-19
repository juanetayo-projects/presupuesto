import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarMonths, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Pencil, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { MoneyInput } from '@/components/money-input'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { eliminarMeta, guardarMeta } from '@/lib/api'
import { fechaLarga, money, pct } from '@/lib/format'
import type { Meta } from '@/lib/types'

/** Ahorro mensual necesario para llegar a la meta en la fecha elegida. */
function aporteSugerido(m: Meta) {
  if (!m.fecha_meta) return null
  const meses = Math.max(1, differenceInCalendarMonths(parseISO(m.fecha_meta), new Date()))
  return Math.max(0, Math.ceil((Number(m.objetivo) - Number(m.ahorrado)) / meses))
}

export function MetasResumen() {
  const { metas } = useData()
  const activas = metas.filter((m) => m.activo)
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-primary" /> Metas de ahorro
        </CardTitle>
        <CardDescription>Progreso hacia cada objetivo</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {activas.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay metas.</p>}
        {activas.map((m) => (
          <BarraMeta key={m.id} m={m} />
        ))}
        <Button asChild variant="link" size="sm" className="justify-self-start px-0">
          <Link to="/deudas">Gestionar metas</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function BarraMeta({ m, onEdit }: { m: Meta; onEdit?: () => void }) {
  const avance = pct(Number(m.ahorrado), Number(m.objetivo))
  const sugerido = aporteSugerido(m)
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 truncate text-sm font-medium">{m.nombre}</p>
        <span className="text-sm font-semibold tabular-nums">{avance.toFixed(0)}%</span>
        {onEdit && (
          <Button variant="ghost" size="icon-xs" aria-label="Editar meta" onClick={onEdit}>
            <Pencil />
          </Button>
        )}
      </div>
      <Progress value={avance} className="mt-2 h-2" />
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        {money(m.ahorrado)} de {money(m.objetivo)}
        {m.fecha_meta && ` · ${fechaLarga(m.fecha_meta)}`}
      </p>
      {sugerido != null && sugerido > 0 && <p className="text-xs text-muted-foreground">Ahorra {money(sugerido)}/mes para lograrla a tiempo</p>}
    </div>
  )
}

export function MetasSeccion() {
  const { metas } = useData()
  const [editando, setEditando] = useState<Partial<Meta> | null>(null)
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Metas de ahorro</h3>
        <Button size="sm" variant="outline" onClick={() => setEditando({ objetivo: 0, ahorrado: 0, activo: true })}>
          <Plus /> Nueva meta
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metas.map((m) => (
          <BarraMeta key={m.id} m={m} onEdit={() => setEditando(m)} />
        ))}
      </div>
      <MetaForm meta={editando} onClose={() => setEditando(null)} />
    </section>
  )
}

function MetaForm({ meta, onClose }: { meta: Partial<Meta> | null; onClose: () => void }) {
  const { recargar } = useData()
  const [m, setM] = useState<Partial<Meta>>({})
  const [abono, setAbono] = useState(0)
  useEffect(() => {
    setM(meta ?? {})
    setAbono(0)
  }, [meta])

  async function guardar() {
    if (!m.nombre?.trim() || !m.objetivo) return toast.error('Nombre y valor objetivo son obligatorios')
    try {
      await guardarMeta({
        id: m.id,
        nombre: m.nombre.trim(),
        objetivo: Number(m.objetivo),
        ahorrado: Number(m.ahorrado ?? 0) + abono,
        fecha_meta: m.fecha_meta || null,
        activo: m.activo ?? true,
        notas: m.notas ?? null,
      })
      toast.success(abono ? `Abono de ${money(abono)} registrado` : 'Meta guardada')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    }
  }

  async function borrar() {
    if (!m.id || !window.confirm(`¿Eliminar la meta ${m.nombre}?`)) return
    await eliminarMeta(m.id)
    await recargar()
    onClose()
  }

  return (
    <ResponsiveModal
      open={Boolean(meta)}
      onOpenChange={(v) => !v && onClose()}
      title={m.id ? m.nombre ?? 'Meta' : 'Nueva meta de ahorro'}
      description="Ej. fondo de emergencia, vacaciones, matrícula, cambio de moto."
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
        <div className="grid gap-1.5">
          <Label htmlFor="m-nombre">Nombre</Label>
          <Input id="m-nombre" value={m.nombre ?? ''} onChange={(e) => setM({ ...m, nombre: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="m-obj">Valor objetivo</Label>
            <MoneyInput id="m-obj" value={Number(m.objetivo ?? 0)} onChange={(v) => setM({ ...m, objetivo: v })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-fecha">Fecha meta</Label>
            <Input id="m-fecha" type="date" value={m.fecha_meta ?? ''} onChange={(e) => setM({ ...m, fecha_meta: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="m-ahorrado">Ahorrado a hoy</Label>
            <MoneyInput id="m-ahorrado" value={Number(m.ahorrado ?? 0)} onChange={(v) => setM({ ...m, ahorrado: v })} />
          </div>
          {m.id && (
            <div className="grid gap-1.5">
              <Label htmlFor="m-abono">Sumar abono</Label>
              <MoneyInput id="m-abono" value={abono} onChange={setAbono} />
            </div>
          )}
        </div>
        {m.id && (
          <Button variant="destructive" size="sm" className="justify-self-start" onClick={borrar}>
            Eliminar meta
          </Button>
        )}
      </div>
    </ResponsiveModal>
  )
}
