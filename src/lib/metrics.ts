import { diasHasta } from './format'
import type { Filtros } from '@/context/data'
import type { Categoria, EstadoMes, Gasto, Ingreso, ObligacionVista } from './types'

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
 * saldo inicial menos los abonos pagados hasta el último día de ese mes.
 * En meses futuros además descuenta las cuotas estimadas pendientes hasta ese mes (saldo proyectado).
 */
export function deudaAlMes(periodo: string, obligaciones: ObligacionVista[], gastos: Gasto[], estado: EstadoMes) {
  const fin = finDeMes(periodo)
  let total = 0
  for (const o of obligaciones) {
    if (o.tipo === 'cadena' || !o.activo || o.saldo_inicial == null) continue
    const desde = o.fecha_saldo ?? '1900-01-01'
    let abonos = 0
    for (const g of gastos) {
      if (g.obligacion_id !== o.id) continue
      const fecha = g.fecha_pago ?? finDeMes(g.periodo)
      if (g.estado === 'pagado' && fecha >= desde && fecha <= fin) {
        abonos += Number(g.abono_capital ?? g.valor_pagado ?? 0)
      } else if (estado === 'futuro' && g.estado === 'pendiente' && g.periodo <= periodo && (!g.fecha_limite || g.fecha_limite >= desde)) {
        abonos += Number(g.valor_presupuestado)
      }
    }
    total += Math.max(0, Number(o.saldo_inicial) - abonos)
  }
  return total
}

/**
 * Valor de un gasto en el histórico mes a mes.
 * - 'real': en meses pasados/actual sólo cuenta lo pagado (el gasto realizado);
 *   en meses futuros, lo presupuestado (valor estimado a pagar).
 * - 'presupuesto': siempre lo presupuestado.
 */
export function valorHistorico(g: Gasto, estado: EstadoMes, modo: 'real' | 'presupuesto') {
  if (g.estado === 'omitido') return 0
  if (modo === 'presupuesto') return Number(g.valor_presupuestado)
  if (estado === 'futuro') return valorGasto(g)
  return g.estado === 'pagado' ? Number(g.valor_pagado ?? g.valor_presupuestado) : 0
}

export const ETIQUETA_MES: Record<EstadoMes, string> = {
  cerrado: 'Cerrado',
  pasado: 'Sin cerrar',
  actual: 'En curso',
  futuro: 'Estimado',
}
