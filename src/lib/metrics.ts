import { diasHasta } from './format'
import type { Filtros } from '@/context/data'
import type { Categoria, Concepto, EstadoMes, Gasto, Ingreso, Movimiento, ObligacionVista } from './types'

export type Urgencia = 'pagado' | 'vencido' | 'hoy' | 'pronto' | 'normal' | 'sin_fecha'

export function urgencia(g: Gasto, diasAlerta: number): Urgencia {
  if (g.estado !== 'pendiente') return 'pagado'
  if (!g.fecha_limite) return 'sin_fecha'
  const d = diasHasta(g.fecha_limite)
  if (d < 0) return 'vencido'
  if (d === 0) return 'hoy'
  if (d <= diasAlerta) return 'pronto'
  return 'normal'
}

/** Valor que cuenta como gasto: lo pagado si ya se pagó, si no lo presupuestado. */
export const valorGasto = (g: Gasto) => (g.estado === 'pagado' ? Number(g.valor_pagado ?? g.valor_presupuestado) : Number(g.valor_presupuestado))

export function aplicarFiltros(gastos: Gasto[], f: Filtros, diasAlerta: number) {
  const t = f.texto.trim().toLowerCase()
  return gastos.filter((g) => {
    if (g.estado === 'omitido' && f.estado !== 'todos') return false
    if (f.categoria !== 'todas' && g.categoria_id !== f.categoria) return false
    if (f.medio !== 'todos' && (g.medio_pago ?? 'Sin medio') !== f.medio) return false
    if (f.responsable && f.responsable !== 'todos' && (g.responsable ?? 'Familiar') !== f.responsable) return false
    if (f.estado === 'pendiente' && g.estado !== 'pendiente') return false
    if (f.estado === 'pagado' && g.estado !== 'pagado') return false
    if (f.estado === 'vencido' && urgencia(g, diasAlerta) !== 'vencido') return false
    if (t && !g.descripcion.toLowerCase().includes(t)) return false
    return true
  })
}

export function resumen(gastos: Gasto[], ingresos: Ingreso[]) {
  const activos = gastos.filter((g) => g.estado !== 'omitido')
  const ingreso = ingresos.reduce((s, i) => s + Number(i.valor), 0)
  const presupuestado = activos.reduce((s, g) => s + Number(g.valor_presupuestado), 0)
  const pagado = activos.filter((g) => g.estado === 'pagado').reduce((s, g) => s + Number(g.valor_pagado ?? 0), 0)
  const total = activos.reduce((s, g) => s + valorGasto(g), 0)
  const pendiente = activos.filter((g) => g.estado === 'pendiente').reduce((s, g) => s + Number(g.valor_presupuestado), 0)
  return {
    ingreso,
    presupuestado,
    pagado,
    pendiente,
    total,
    disponible: ingreso - total,
    nPendientes: activos.filter((g) => g.estado === 'pendiente').length,
    nPagados: activos.filter((g) => g.estado === 'pagado').length,
    n: activos.length,
  }
}

export interface Detalle {
  nombre: string
  valor: number
  extra?: string
}

export interface Porcion {
  key: string
  nombre: string
  valor: number
  color: string
  pct: number
  /** Desglose para el tooltip: conceptos de la categoría, o registros/conceptos que suman la barra. */
  detalle: Detalle[]
}

const ordenar = (d: Detalle[]) => d.sort((a, b) => b.valor - a.valor)

export function porCategoria(gastos: Gasto[], categorias: Categoria[]): Porcion[] {
  const map = new Map<string, number>()
  for (const g of gastos) if (g.estado !== 'omitido') map.set(g.categoria_id, (map.get(g.categoria_id) ?? 0) + valorGasto(g))
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  return categorias
    .filter((c) => map.get(c.id))
    .map((c) => {
      const porConc = new Map<string, number>()
      for (const g of gastos) if (g.categoria_id === c.id && g.estado !== 'omitido') porConc.set(g.descripcion, (porConc.get(g.descripcion) ?? 0) + valorGasto(g))
      return {
        key: c.id,
        nombre: c.nombre,
        valor: map.get(c.id)!,
        color: c.color,
        pct: total ? (map.get(c.id)! / total) * 100 : 0,
        detalle: ordenar([...porConc].map(([nombre, valor]) => ({ nombre, valor }))),
      }
    })
    .sort((a, b) => b.valor - a.valor)
}

export function porConcepto(gastos: Gasto[], catPorId: Map<string, Categoria>): Porcion[] {
  const map = new Map<string, { valor: number; cat: string; items: Gasto[] }>()
  for (const g of gastos) {
    if (g.estado === 'omitido') continue
    const k = g.descripcion
    const prev = map.get(k)
    map.set(k, { valor: (prev?.valor ?? 0) + valorGasto(g), cat: g.categoria_id, items: [...(prev?.items ?? []), g] })
  }
  const total = [...map.values()].reduce((a, b) => a + b.valor, 0)
  return [...map.entries()]
    .map(([nombre, v]) => ({
      key: nombre,
      nombre,
      valor: v.valor,
      color: catPorId.get(v.cat)?.color ?? '#64748b',
      pct: total ? (v.valor / total) * 100 : 0,
      // cada registro del concepto: categoría · responsable · estado
      detalle: v.items.map((g) => ({
        nombre: catPorId.get(g.categoria_id)?.nombre ?? '',
        valor: valorGasto(g),
        extra: [g.responsable && g.responsable !== 'Familiar' ? g.responsable : 'Familiar', g.estado === 'pagado' ? 'pagado' : 'pendiente', g.cuotas_total ? `cuota ${g.cuota_num}/${g.cuotas_total}` : '']
          .filter(Boolean)
          .join(' · '),
      })),
    }))
    .sort((a, b) => b.valor - a.valor)
}

/** Último día (yyyy-mm-dd) del mes de un periodo 'yyyy-mm-01'. */
export function finDeMes(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${periodo.slice(0, 8)}${String(ultimo).padStart(2, '0')}`
}

/**
 * Saldo total de las deudas al cierre del mes indicado (no el saldo de hoy):
 * saldo inicial menos los abonos reales (movimientos) hasta el último día de ese mes.
 * En meses futuros además descuenta las cuotas pendientes del plan hasta ese mes (saldo proyectado).
 */
export function deudaAlMes(periodo: string, obligaciones: ObligacionVista[], movimientos: Movimiento[], gastos: Gasto[], estado: EstadoMes) {
  const fin = finDeMes(periodo)
  let total = 0
  for (const o of obligaciones) {
    if (o.tipo === 'cadena' || !o.activo || o.saldo_inicial == null) continue
    const desde = o.fecha_saldo ?? '1900-01-01'
    let abonos = 0
    for (const m of movimientos) {
      if (m.tipo === 'gasto' && m.obligacion_id === o.id && m.fecha >= desde && m.fecha <= fin) abonos += Number(m.abono_capital ?? m.valor)
    }
    if (estado === 'futuro') {
      for (const g of gastos) {
        if (g.obligacion_id === o.id && g.estado === 'pendiente' && g.periodo <= periodo && (!g.fecha_limite || g.fecha_limite >= desde)) {
          abonos += Number(g.valor_presupuestado)
        }
      }
    }
    total += Math.max(0, Number(o.saldo_inicial) - abonos)
  }
  return total
}

/** Un movimiento de gasto con la forma de un Gasto pagado, para reutilizar gráficas, filtros y tablas. */
export function movComoGasto(m: Movimiento): Gasto {
  return {
    id: m.id,
    periodo: m.periodo,
    concepto_id: null,
    categoria_id: m.categoria_id ?? '',
    obligacion_id: m.obligacion_id,
    descripcion: m.descripcion,
    medio_pago: m.medio_pago,
    valor_presupuestado: Number(m.valor),
    valor_pagado: Number(m.valor),
    abono_capital: m.abono_capital,
    fecha_limite: m.fecha,
    fecha_pago: m.fecha,
    estado: 'pagado',
    grupo_cuotas: null,
    cuota_num: null,
    cuotas_total: null,
    notas: m.notas,
    pagado_por: m.pagado_por,
    responsable: m.responsable,
    clase_gasto: m.obligacion_id ? 'credito' : 'variable',
    arrastre: null,
  }
}

/**
 * Líneas de gasto que cuentan para un conjunto de meses:
 * lo REAL (movimientos) en meses pasados y el actual, el PLAN (compromisos) en meses futuros.
 */
export function lineasGasto(gastos: Gasto[], movimientos: Movimiento[], estadoMes: (p: string) => EstadoMes) {
  const reales = movimientos.filter((m) => m.tipo === 'gasto' && estadoMes(m.periodo) !== 'futuro').map(movComoGasto)
  const plan = gastos.filter((g) => g.estado !== 'omitido' && estadoMes(g.periodo) === 'futuro')
  return [...reales, ...plan]
}

/** Ingresos de un mes: los recibidos (movimientos) en meses pasados/actual; los esperados (plan) en meses futuros. */
export function ingresoMes(periodo: string, estado: EstadoMes, movimientos: Movimiento[], ingresos: Ingreso[]) {
  const esperado = ingresos.filter((i) => i.periodo === periodo).reduce((s, i) => s + Number(i.valor), 0)
  const recibido = movimientos.filter((m) => m.tipo === 'ingreso' && m.periodo === periodo).reduce((s, m) => s + Number(m.valor), 0)
  return { esperado, recibido, valor: estado === 'futuro' ? esperado : recibido }
}

export const ETIQUETA_MES: Record<EstadoMes, string> = {
  cerrado: 'Cerrado',
  pasado: 'Sin cerrar',
  actual: 'En curso',
  futuro: 'Estimado',
}

export interface OpcionesClonar {
  credito: boolean
  fijo: boolean
  variable: boolean
  /** Créditos: sumar lo que quedó sin pagar en el mes origen. */
  arrastrar: boolean
  ingresos: boolean
}

export interface FilaClon {
  origen: Gasto
  base: number
  arrastre: number
  valor: number
}

/**
 * Vista previa de clonar el plan de `origen` a `destino`:
 * - Crédito: valor del mes origen (sin su arrastre) + lo no pagado allí, si `arrastrar`.
 * - Fijo y variable: el mismo valor del mes origen.
 * No repite lo que ya está en el destino, ni cuotas de compras divididas (ya están proyectadas), ni ítems que terminaron.
 */
export function planClonado(origen: string, destino: string, gastos: Gasto[], conceptos: Concepto[], op: OpcionesClonar) {
  const enDestino = gastos.filter((g) => g.periodo === destino)
  const yaEsta = (g: Gasto) => enDestino.some((d) => (g.concepto_id && d.concepto_id === g.concepto_id) || d.descripcion.trim().toLowerCase() === g.descripcion.trim().toLowerCase())
  const terminados = new Set(conceptos.filter((c) => c.hasta_periodo && c.hasta_periodo < destino).map((c) => c.id))
  const filas: FilaClon[] = []
  const saltados: { g: Gasto; motivo: string }[] = []
  for (const g of gastos.filter((x) => x.periodo === origen)) {
    if (g.estado === 'omitido') continue
    if (g.grupo_cuotas) saltados.push({ g, motivo: 'cuota de una compra dividida (ya está proyectada)' })
    else if (g.concepto_id && terminados.has(g.concepto_id)) saltados.push({ g, motivo: 'el ítem ya terminó' })
    else if (yaEsta(g)) saltados.push({ g, motivo: 'ya está en el mes destino' })
    else if (!op[g.clase_gasto]) saltados.push({ g, motivo: 'tipo no incluido' })
    else {
      const base = Math.max(0, Number(g.valor_presupuestado) - Number(g.arrastre ?? 0))
      const noPagado = g.estado === 'pagado' ? Math.max(0, Number(g.valor_presupuestado) - Number(g.valor_pagado ?? 0)) : Number(g.valor_presupuestado)
      const arrastre = g.clase_gasto === 'credito' && op.arrastrar ? noPagado : 0
      filas.push({ origen: g, base, arrastre, valor: base + arrastre })
    }
  }
  return { filas, saltados }
}
