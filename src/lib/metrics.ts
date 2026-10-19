import { diasHasta } from './format'
import type { Filtros } from '@/context/data'
import type { Categoria, Gasto, Ingreso } from './types'

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

export interface Porcion {
  key: string
  nombre: string
  valor: number
  color: string
  pct: number
}

export function porCategoria(gastos: Gasto[], categorias: Categoria[]): Porcion[] {
  const map = new Map<string, number>()
  for (const g of gastos) if (g.estado !== 'omitido') map.set(g.categoria_id, (map.get(g.categoria_id) ?? 0) + valorGasto(g))
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  return categorias
    .filter((c) => map.get(c.id))
    .map((c) => ({ key: c.id, nombre: c.nombre, valor: map.get(c.id)!, color: c.color, pct: total ? (map.get(c.id)! / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)
}

export function porConcepto(gastos: Gasto[], catPorId: Map<string, Categoria>): Porcion[] {
  const map = new Map<string, { valor: number; cat: string }>()
  for (const g of gastos) {
    if (g.estado === 'omitido') continue
    const k = g.descripcion
    const prev = map.get(k)
    map.set(k, { valor: (prev?.valor ?? 0) + valorGasto(g), cat: g.categoria_id })
  }
  const total = [...map.values()].reduce((a, b) => a + b.valor, 0)
  return [...map.entries()]
    .map(([nombre, v]) => ({ key: nombre, nombre, valor: v.valor, color: catPorId.get(v.cat)?.color ?? '#64748b', pct: total ? (v.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)
}
