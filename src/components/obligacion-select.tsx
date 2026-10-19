import { Plus } from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useData } from '@/context/data'
import { guardarObligacion } from '@/lib/api'
import { TIPOS_OBLIGACION, type Obligacion, type TipoObligacion } from '@/lib/types'

export const SIN_DEUDA = '__ninguno__'
export const NUEVA_DEUDA = '__nueva__'

/** Dominio del logo según el medio de pago (para deudas creadas desde un gasto). */
const LOGO_POR_MEDIO: Record<string, string> = {
  Davivienda: 'davivienda.com',
  Bancolombia: 'bancolombia.com',
  Nu: 'nu.com.co',
  ADDI: 'addi.com',
  Sistecredito: 'sistecredito.com',
  Nequi: 'nequi.com.co',
  Daviplata: 'daviplata.com',
}

/**
 * Selector de préstamo/deuda agrupado por persona, con la opción de crear una deuda nueva
 * (p. ej. una tarjeta de crédito recién agregada) sin salir del formulario.
 */
export function ObligacionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { obligaciones, config } = useData()
  const grupos = config.responsables
    .map((r) => ({ r, items: obligaciones.filter((o) => (o.responsable || 'Familiar') === r).sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
    .filter((g) => g.items.length)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_DEUDA}>No aplica</SelectItem>
        <SelectItem value={NUEVA_DEUDA} className="font-medium text-primary">
          <Plus /> Crear deuda nueva…
        </SelectItem>
        {grupos.map((g) => (
          <SelectGroup key={g.r}>
            <SelectSeparator />
            <SelectLabel>{g.r === 'Familiar' ? 'Familiares' : g.r}</SelectLabel>
            {g.items.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nombre}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TipoDeudaSelect({ value, onChange }: { value: TipoObligacion; onChange: (v: TipoObligacion) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TipoObligacion)}>
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
  )
}

/** Si el valor es NUEVA_DEUDA crea la obligación y devuelve su id; si no, el id elegido o null. */
export async function resolverObligacion(
  valor: string,
  datos: { nombre: string; tipo: TipoObligacion; medio: string | null; cuota: number; responsable: string },
): Promise<string | null> {
  if (valor === SIN_DEUDA) return null
  if (valor !== NUEVA_DEUDA) return valor
  const creada = (await guardarObligacion({
    nombre: datos.nombre,
    entidad: datos.medio && datos.medio !== 'Efectivo' && datos.medio !== 'Otro' ? datos.medio : null,
    tipo: datos.tipo,
    cuota: datos.cuota || null,
    responsable: datos.responsable,
    logo: datos.medio ? LOGO_POR_MEDIO[datos.medio] ?? null : null,
    notas: 'Creada desde un gasto: registrar saldo',
  })) as Obligacion
  return creada.id
}
