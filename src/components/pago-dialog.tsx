import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/auth'
import { ResponsiveModal } from '@/components/responsive-modal'
import { useData } from '@/context/data'
import { registrarPago } from '@/lib/api'
import { hoyISO, money } from '@/lib/format'
import type { Gasto } from '@/lib/types'

export function PagoDialog({ gasto, onClose }: { gasto: Gasto | null; onClose: () => void }) {
  const { obligaciones, miembros, recargar } = useData()
  const { session } = useAuth()
  const yo = miembros.find((m) => m.email === session?.user.email)?.nombre ?? ''
  const [pagadoPor, setPagadoPor] = useState(yo)
  const [valor, setValor] = useState(0)
  const [fecha, setFecha] = useState(hoyISO())
  const [abono, setAbono] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const obligacion = gasto?.obligacion_id ? obligaciones.find((o) => o.id === gasto.obligacion_id) : null
  const pideAbono = obligacion && obligacion.tipo !== 'cadena'

  useEffect(() => {
    if (!gasto) return
    setValor(Number(gasto.valor_presupuestado))
    setFecha(hoyISO())
    setAbono(null)
    setPagadoPor(yo)
  }, [gasto, yo])

  async function confirmar() {
    if (!gasto) return
    setGuardando(true)
    try {
      await registrarPago(gasto, valor, fecha, pideAbono && abono ? abono : null, pagadoPor || null)
      toast.success(`Pago registrado: ${gasto.descripcion}`)
      await recargar()
      onClose()
    } catch (e) {
      toast.error('No se pudo registrar el pago', { description: (e as Error).message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ResponsiveModal
      open={Boolean(gasto)}
      onOpenChange={(v) => !v && onClose()}
      title="Registrar pago"
      description={gasto ? `${gasto.descripcion} · presupuestado ${money(gasto.valor_presupuestado)}` : ''}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando || valor <= 0}>
            {guardando ? 'Guardando…' : 'Marcar como pagado'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p-valor">Valor pagado</Label>
            <MoneyInput id="p-valor" value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-fecha">Fecha de pago</Label>
            <Input id="p-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        {miembros.length > 1 && (
          <div className="grid gap-1.5">
            <Label>Pagado por</Label>
            <Select value={pagadoPor} onValueChange={setPagadoPor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="¿Quién pagó?" />
              </SelectTrigger>
              <SelectContent>
                {miembros.map((m) => (
                  <SelectItem key={m.email} value={m.nombre}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {pideAbono && (
          <div className="grid gap-1.5">
            <Label htmlFor="p-abono">Abono a capital (opcional)</Label>
            <MoneyInput id="p-abono" value={abono} onChange={setAbono} placeholder="Igual al valor pagado" />
            <p className="text-xs text-muted-foreground">
              Si el extracto separa intereses, escribe sólo lo que bajó la deuda. Vacío = se descuenta todo el pago del saldo de{' '}
              {obligacion?.nombre}.
            </p>
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
