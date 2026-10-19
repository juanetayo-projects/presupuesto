import { Input } from '@/components/ui/input'
import { parseMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (v: number) => void
  id?: string
  className?: string
  placeholder?: string
}

/** Campo de pesos con separador de miles; teclado numérico en el celular. */
export function MoneyInput({ value, onChange, id, className, placeholder = '0' }: Props) {
  const shown = value ? Number(value).toLocaleString('es-CO') : ''
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-7 tabular-nums"
        placeholder={placeholder}
        value={shown}
        onChange={(e) => onChange(parseMoney(e.target.value))}
      />
    </div>
  )
}
