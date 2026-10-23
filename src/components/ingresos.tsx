import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Repeat, Trash2, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MoneyInput } from '@/components/money-input'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { crearIngresos, eliminarIngreso, eliminarIngresosGrupo, guardarIngreso } from '@/lib/api'
import { money, nombreMes, periodoMas } from '@/lib/format'
import { TIPOS_INGRESO, type Ingreso } from '@/lib/types'

/** Lista CRUD de los ingresos del mes seleccionado. */
export function IngresosCard() {
  const { periodo, ingresos } = useData()
  const [editando, setEditando] = useState<Partial<Ingreso> | null>(null)
  const delMes = ingresos.filter((i) => i.periodo === periodo)
  const total = delMes.reduce((s, i) => s + Number(i.valor), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" /> Ingresos esperados de {nombreMes(periodo)}
        </CardTitle>
        <CardDescription>Salario, primas, arriendos, ventas, ingresos extra… Total {money(total)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {delMes.length === 0 && <p className="text-sm text-muted-foreground">Este mes no tiene ingresos registrados.</p>}
        {delMes.map((i) => (
          <button
            key={i.id}
            onClick={() => setEditando(i)}
            className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.descripcion}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {i.tipo}
                {i.grupo && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Repeat /> recurrente
                  </Badge>
                )}
              </p>
            </div>
            <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">{money(i.valor)}</span>
            <Pencil className="size-3.5 text-muted-foreground" />
          </button>
        ))}
        <Button variant="outline" className="w-full" onClick={() => setEditando({ periodo, tipo: 'Otro', valor: 0 })}>
          <Plus /> Agregar ingreso
        </Button>
      </CardContent>
      <IngresoForm ingreso={editando} onClose={() => setEditando(null)} />
    </Card>
  )
}

export function IngresoForm({ ingreso, onClose }: { ingreso: Partial<Ingreso> | null; onClose: () => void }) {
  const { periodo, recargar } = useData()
  const [f, setF] = useState<Partial<Ingreso>>({})
  const [repetir, setRepetir] = useState(false)
  const [meses, setMeses] = useState(12)
  const [guardando, setGuardando] = useState(false)
  const editando = Boolean(ingreso?.id)

  useEffect(() => {
    if (!ingreso) return
    setF({ periodo, tipo: 'Otro', ...ingreso })
    setRepetir(false)
    setMeses(12)
  }, [ingreso, periodo])

  const hasta = useMemo(() => (f.periodo ? nombreMes(periodoMas(f.periodo, meses - 1)) : ''), [f.periodo, meses])

  async function guardar() {
    if (!f.descripcion?.trim()) return toast.error('Escribe la descripción del ingreso')
    if (!f.valor || f.valor <= 0) return toast.error('El valor debe ser mayor a cero')
    setGuardando(true)
    try {
      const datos = { periodo: f.periodo!, descripcion: f.descripcion.trim(), tipo: f.tipo ?? 'Otro', valor: Number(f.valor), notas: f.notas?.trim() || null }
      if (editando) await guardarIngreso({ id: f.id, ...datos })
      else await crearIngresos(datos, repetir ? meses : 1)
      toast.success(editando ? 'Ingreso actualizado' : repetir ? `Ingreso creado por ${meses} meses` : 'Ingreso agregado')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message })
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(todoElGrupo: boolean) {
    if (!f.id) return
    const msg = todoElGrupo ? '¿Eliminar este ingreso y los de los meses siguientes del mismo grupo?' : '¿Eliminar este ingreso?'
    if (!window.confirm(msg)) return
    try {
      if (todoElGrupo && f.grupo) await eliminarIngresosGrupo(f.grupo, f.periodo!)
      else await eliminarIngreso(f.id)
      toast.success('Ingreso eliminado')
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo eliminar', { description: (e as Error).message })
    }
  }

  return (
    <ResponsiveModal
      open={Boolean(ingreso)}
      onOpenChange={(v) => !v && onClose()}
      title={editando ? 'Editar ingreso esperado' : 'Nuevo ingreso esperado'}
      description="Cualquier entrada de dinero del hogar."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-1">
        <div className="grid gap-1.5">
          <Label htmlFor="i-desc">Descripción</Label>
          <Input id="i-desc" value={f.descripcion ?? ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej. Prima de diciembre, arriendo apto…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="i-valor">Valor</Label>
            <MoneyInput id="i-valor" value={Number(f.valor ?? 0)} onChange={(v) => setF({ ...f, valor: v })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={f.tipo ?? 'Otro'} onValueChange={(v) => setF({ ...f, tipo: v })}>
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
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="i-mes">Mes</Label>
          <Input id="i-mes" type="month" value={(f.periodo ?? periodo).slice(0, 7)} onChange={(e) => e.target.value && setF({ ...f, periodo: `${e.target.value}-01` })} />
        </div>
        {!editando && (
          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Repetir en los meses siguientes</p>
                <p className="text-xs text-muted-foreground">Para ingresos fijos (salario, arriendo, pensión).</p>
              </div>
              <Switch checked={repetir} onCheckedChange={setRepetir} />
            </div>
            {repetir && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Input type="number" min={2} max={36} className="w-20" value={meses} onChange={(e) => setMeses(Math.max(2, Math.min(36, Number(e.target.value) || 2)))} />
                <span className="text-muted-foreground">meses · hasta {hasta}</span>
              </div>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="i-notas">Notas</Label>
          <Textarea id="i-notas" rows={2} value={f.notas ?? ''} onChange={(e) => setF({ ...f, notas: e.target.value })} />
        </div>
        {editando && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="destructive" size="sm" onClick={() => borrar(false)}>
              <Trash2 /> Eliminar este ingreso
            </Button>
            {f.grupo && (
              <Button variant="outline" size="sm" onClick={() => borrar(true)}>
                Eliminar también los meses siguientes
              </Button>
            )}
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
