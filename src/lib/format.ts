import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const money = (n: number | null | undefined) => cop.format(Number(n ?? 0))

/** $1,5 M · $350 mil — para ejes y etiquetas de gráficas */
export function moneyShort(n: number) {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (v >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CO')} mil`
  return `$${n}`
}

export const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0)
export const pctLabel = (part: number, total: number, digits = 1) =>
  `${pct(part, total).toLocaleString('es-CO', { maximumFractionDigits: digits })}%`

/** periodo = 'YYYY-MM-01' */
export const periodoActual = () => format(new Date(), 'yyyy-MM-01')
export const periodoMas = (periodo: string, n: number) => format(addMonths(parseISO(periodo), n), 'yyyy-MM-01')
export const nombreMes = (periodo: string) => {
  const s = format(parseISO(periodo), 'MMMM yyyy', { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const mesCorto = (periodo: string) => format(parseISO(periodo), 'MMM yy', { locale: es })

export const fechaCorta = (iso: string | null) => (iso ? format(parseISO(iso), "d MMM", { locale: es }) : '—')
export const fechaLarga = (iso: string | null) => (iso ? format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es }) : '—')
export const hoyISO = () => format(new Date(), 'yyyy-MM-dd')

export const diasHasta = (iso: string) => differenceInCalendarDays(parseISO(iso), new Date())

/** Fecha límite dentro del periodo, ajustando días que no existen (31 en noviembre → 30). */
export function fechaEnPeriodo(periodo: string, dia: number | null) {
  if (!dia) return null
  const d = parseISO(periodo)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return format(new Date(d.getFullYear(), d.getMonth(), Math.min(dia, ultimo)), 'yyyy-MM-dd')
}

/** Valores en pesos escritos con puntos o comas → número */
export const parseMoney = (s: string) => Number(String(s).replace(/[^\d-]/g, '')) || 0

/** Próxima fecha (hoy o después) en que cae el día `dia` del mes; ajusta meses cortos (31 → 30/28). */
export function proximaFechaDia(dia: number, desde = new Date()) {
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  for (let k = 0; k < 2; k++) {
    const y = hoy.getFullYear()
    const m = hoy.getMonth() + k
    const ultimo = new Date(y, m + 1, 0).getDate()
    const f = new Date(y, m, Math.min(dia, ultimo))
    if (f >= hoy) return format(f, 'yyyy-MM-dd')
  }
  return format(hoy, 'yyyy-MM-dd')
}
