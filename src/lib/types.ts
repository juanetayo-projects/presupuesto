export type Estado = 'pendiente' | 'pagado' | 'omitido'
export type TipoObligacion = 'prestamo' | 'tarjeta' | 'credito_cuotas' | 'cadena' | 'otro'

export interface Categoria {
  id: string
  nombre: string
  color: string
  icono: string
  orden: number
  activo: boolean
  clase: ClaseCategoria
}

export type ClaseCategoria = 'necesidad' | 'deseo' | 'ahorro_deuda'

export const CLASES: Record<ClaseCategoria, { label: string; meta: number }> = {
  necesidad: { label: 'Necesidades', meta: 50 },
  deseo: { label: 'Gustos', meta: 30 },
  ahorro_deuda: { label: 'Ahorro y deudas', meta: 20 },
}

export interface Concepto {
  id: string
  categoria_id: string
  obligacion_id: string | null
  nombre: string
  medio_pago: string | null
  valor_base: number
  dia_limite: number | null
  recurrente: boolean
  activo: boolean
  orden: number
  notas: string | null
  responsable: string
  logo: string | null
  icono: string | null
  /** Último mes en que se genera (yyyy-mm-01); null = sin fin. */
  hasta_periodo: string | null
}

export interface Gasto {
  id: string
  periodo: string
  concepto_id: string | null
  categoria_id: string
  obligacion_id: string | null
  descripcion: string
  medio_pago: string | null
  valor_presupuestado: number
  valor_pagado: number | null
  abono_capital: number | null
  fecha_limite: string | null
  fecha_pago: string | null
  estado: Estado
  grupo_cuotas: string | null
  cuota_num: number | null
  cuotas_total: number | null
  notas: string | null
  pagado_por: string | null
  responsable: string
}

export interface Ingreso {
  id: string
  periodo: string
  descripcion: string
  valor: number
  tipo: string
  notas: string | null
  grupo: string | null
}

export const TIPOS_INGRESO = ['Salario', 'Honorarios', 'Prima', 'Arriendo', 'Pensión', 'Ventas / negocio', 'Bonificación', 'Reembolso', 'Otro']

export interface Obligacion {
  id: string
  nombre: string
  entidad: string | null
  tipo: TipoObligacion
  monto_inicial: number | null
  saldo_inicial: number | null
  fecha_saldo: string | null
  cuota: number | null
  tasa_mensual: number | null
  num_cuotas: number | null
  fecha_inicio: string | null
  fecha_cobro: string | null
  activo: boolean
  notas: string | null
  logo: string | null
  responsable: string
  /** Tarjetas de crédito: día del mes en que corta el extracto. */
  dia_corte: number | null
}

export interface ObligacionVista extends Obligacion {
  total_pagado: number
  total_abonos: number
  cuotas_pagadas: number
  ultimo_pago: string | null
  saldo_actual: number | null
}

export interface Miembro {
  email: string
  nombre: string
}

export const TIPOS_OBLIGACION: Record<TipoObligacion, string> = {
  prestamo: 'Préstamo',
  tarjeta: 'Tarjeta de crédito',
  credito_cuotas: 'Compra a cuotas',
  cadena: 'Cadena de ahorro',
  otro: 'Por definir',
}

export const MEDIOS_PAGO = ['Davivienda', 'Bancolombia', 'Nu', 'Sistecredito', 'ADDI', 'Nequi', 'Daviplata', 'Efectivo', 'Otro']

export const RESPONSABLES_DEFAULT = ['Familiar', 'Pily', 'Juank']

export interface Meta {
  id: string
  nombre: string
  objetivo: number
  ahorrado: number
  fecha_meta: string | null
  icono: string
  activo: boolean
  notas: string | null
}

/** Foto de un mes cerrado: sus gastos e ingresos quedan congelados en la base. */
export interface CierreMes {
  periodo: string
  resumen: { ingreso?: number; total?: number; pagado?: number; pendiente?: number; categorias?: Record<string, number> }
  cerrado_por: string | null
  cerrado_en: string
}

/**
 * - cerrado: congelado, no admite cambios.
 * - pasado: ya terminó pero sigue abierto (conviene cerrarlo).
 * - actual: el mes en curso.
 * - futuro: lo registrado son valores estimados a pagar, no gastos.
 */
export type EstadoMes = 'cerrado' | 'pasado' | 'actual' | 'futuro'

/**
 * Lo REAL: un gasto que se pagó o un ingreso que se recibió. Su mes (`periodo`) sale de la fecha.
 * Si paga un compromiso del plan, `gasto_id` lo enlaza (el compromiso queda "pagado" automáticamente).
 */
export interface Movimiento {
  id: string
  tipo: 'gasto' | 'ingreso'
  fecha: string
  periodo: string
  valor: number
  categoria_id: string | null
  descripcion: string
  medio_pago: string | null
  responsable: string
  gasto_id: string | null
  obligacion_id: string | null
  abono_capital: number | null
  tipo_ingreso: string | null
  pagado_por: string | null
  notas: string | null
  creado_por: string | null
  creado_en: string
}

export type MovimientoInput = Omit<Movimiento, 'id' | 'periodo' | 'creado_por' | 'creado_en'>
