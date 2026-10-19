import { supabase } from './supabase'
import { fechaEnPeriodo, periodoMas } from './format'
import type { Concepto, Gasto, Ingreso, Meta, Obligacion } from './types'

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message)
  return data
}

// Modo demo sólo en desarrollo local (http://localhost:5173/?demo), con datos de src/dev/*.local.ts
const demos = import.meta.glob("../dev/*.local.ts")
export const esDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo")

export async function cargarTodo() {
  if (esDemo) {
    const carga = Object.values(demos)[0]
    if (carga) return ((await carga()) as { demo: Awaited<ReturnType<typeof cargarReal>> }).demo
  }
  return cargarReal()
}

async function cargarReal() {
  const [categorias, conceptos, obligaciones, gastos, ingresos, config, miembros, metas] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('conceptos').select('*').order('orden'),
    supabase.from('v_obligaciones').select('*').order('nombre'),
    supabase.from('gastos').select('*').order('fecha_limite', { nullsFirst: false }),
    supabase.from('ingresos').select('*').order('periodo'),
    supabase.from('configuracion').select('*'),
    supabase.from('miembros').select('email,nombre').order('nombre'),
    supabase.from('metas').select('*').order('creado_en'),
  ])
  const cfg: Record<string, unknown> = {}
  for (const r of check(config) ?? []) cfg[r.clave] = r.valor
  return {
    categorias: check(categorias) ?? [],
    conceptos: check(conceptos) ?? [],
    obligaciones: check(obligaciones) ?? [],
    gastos: check(gastos) ?? [],
    ingresos: check(ingresos) ?? [],
    config: {
      ingresoBase: Number(cfg.ingreso_base ?? 6600000),
      diasAlerta: Number(cfg.dias_alerta ?? 5),
      pctImprevistos: Number(cfg.pct_imprevistos ?? 5),
    },
    miembros: check(miembros) ?? [],
    metas: (check(metas) ?? []) as Meta[],
  }
}

export async function guardarConfig(clave: string, valor: unknown) {
  check(await supabase.from('configuracion').upsert({ clave, valor }))
}

/**
 * Crea el presupuesto de un mes a partir de la plantilla de conceptos recurrentes.
 * Sólo agrega lo que falta: se puede ejecutar varias veces sin duplicar.
 */
export async function generarMes(periodo: string, conceptos: Concepto[], gastosMes: Gasto[], ingresosMes: Ingreso[], ingresoBase: number) {
  const yaEstan = new Set(gastosMes.map((g) => g.concepto_id).filter(Boolean))
  const nuevos = conceptos
    .filter((c) => c.activo && c.recurrente && !yaEstan.has(c.id))
    .map((c) => ({
      periodo,
      concepto_id: c.id,
      categoria_id: c.categoria_id,
      obligacion_id: c.obligacion_id,
      descripcion: c.nombre,
      medio_pago: c.medio_pago,
      valor_presupuestado: c.valor_base,
      fecha_limite: fechaEnPeriodo(periodo, c.dia_limite),
    }))
  if (nuevos.length) check(await supabase.from('gastos').insert(nuevos))
  if (ingresosMes.length === 0) {
    check(await supabase.from('ingresos').insert({ periodo, descripcion: 'Ingreso base', valor: ingresoBase }))
  }
  return nuevos.length
}

export type GastoInput = Omit<Gasto, 'id' | 'grupo_cuotas' | 'cuota_num' | 'cuotas_total'>

/**
 * Inserta un gasto. Si cuotas > 1 lo reparte en meses consecutivos con el mismo grupo,
 * marcando "cuota i de n". `modo` indica si el valor digitado es el total o el de cada cuota.
 */
export async function crearGasto(g: GastoInput, cuotas = 1, modo: 'total' | 'cuota' = 'total') {
  if (cuotas <= 1) {
    check(await supabase.from('gastos').insert(g))
    return
  }
  const grupo = crypto.randomUUID()
  const total = modo === 'total' ? g.valor_presupuestado : g.valor_presupuestado * cuotas
  const base = Math.floor(total / cuotas)
  const dia = g.fecha_limite ? Number(g.fecha_limite.slice(8, 10)) : null
  const filas = Array.from({ length: cuotas }, (_, i) => {
    const periodo = periodoMas(g.periodo, i)
    return {
      ...g,
      periodo,
      // la última cuota absorbe el residuo de la división
      valor_presupuestado: i === cuotas - 1 ? total - base * (cuotas - 1) : base,
      fecha_limite: fechaEnPeriodo(periodo, dia),
      estado: i === 0 ? g.estado : 'pendiente',
      valor_pagado: i === 0 ? g.valor_pagado : null,
      fecha_pago: i === 0 ? g.fecha_pago : null,
      grupo_cuotas: grupo,
      cuota_num: i + 1,
      cuotas_total: cuotas,
    }
  })
  check(await supabase.from('gastos').insert(filas))
}

export async function actualizarGasto(id: string, cambios: Partial<Gasto>) {
  check(await supabase.from('gastos').update(cambios).eq('id', id).select())
}

export async function eliminarGasto(g: Gasto, todoElGrupo: boolean) {
  if (todoElGrupo && g.grupo_cuotas) {
    check(await supabase.from('gastos').delete().eq('grupo_cuotas', g.grupo_cuotas).eq('estado', 'pendiente'))
    if (g.estado !== 'pendiente') check(await supabase.from('gastos').delete().eq('id', g.id))
  } else {
    check(await supabase.from('gastos').delete().eq('id', g.id))
  }
}

export async function registrarPago(g: Gasto, valor: number, fecha: string, abono: number | null, pagadoPor: string | null) {
  await actualizarGasto(g.id, { estado: 'pagado', valor_pagado: valor, fecha_pago: fecha, abono_capital: abono, pagado_por: pagadoPor })
}

export async function deshacerPago(g: Gasto) {
  await actualizarGasto(g.id, { estado: 'pendiente', valor_pagado: null, fecha_pago: null, abono_capital: null, pagado_por: null })
}

export async function guardarObligacion(o: Partial<Obligacion> & { nombre: string }) {
  const { id, ...rest } = o
  if (id) check(await supabase.from('obligaciones').update(rest).eq('id', id).select())
  else return check(await supabase.from('obligaciones').insert(rest).select().single()) as Obligacion
}

export async function eliminarObligacion(id: string) {
  check(await supabase.from('obligaciones').delete().eq('id', id))
}

export async function guardarConcepto(c: Partial<Concepto>) {
  const { id, ...rest } = c
  if (id) check(await supabase.from('conceptos').update(rest).eq('id', id).select())
  else check(await supabase.from('conceptos').insert(rest))
}

export async function guardarCategoria(c: { id?: string; nombre: string; color: string; orden?: number; icono?: string; clase?: string }) {
  const { id, ...rest } = c
  if (id) check(await supabase.from('categorias').update(rest).eq('id', id).select())
  else check(await supabase.from('categorias').insert(rest))
}

export async function guardarIngreso(i: Partial<Ingreso>) {
  const { id, ...rest } = i
  if (id) check(await supabase.from('ingresos').update(rest).eq('id', id).select())
  else check(await supabase.from('ingresos').insert(rest))
}

export async function eliminarIngreso(id: string) {
  check(await supabase.from('ingresos').delete().eq('id', id))
}

export async function agregarMiembro(email: string, nombre: string) {
  check(await supabase.from('miembros').insert({ email: email.trim().toLowerCase(), nombre }))
}

export async function eliminarMiembro(email: string) {
  check(await supabase.from('miembros').delete().eq('email', email))
}

export async function eliminarCategoria(id: string) {
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) {
    if (error.code === '23503' || /foreign key/i.test(error.message)) {
      throw new Error('La categoría tiene ítems o gastos. Muévelos a otra categoría o desactívala.')
    }
    throw new Error(error.message)
  }
}

/**
 * Copia los gastos (no cuotas) del mes anterior con sus valores presupuestados.
 * Útil cuando los valores del mes pasado reflejan mejor la realidad que la plantilla.
 */
export async function copiarMesAnterior(periodo: string, anteriores: Gasto[], ingresosAnt: Ingreso[], ingresosMes: Ingreso[]) {
  const filas = anteriores
    .filter((g) => !g.grupo_cuotas && g.estado !== 'omitido')
    .map((g) => ({
      periodo,
      concepto_id: g.concepto_id,
      categoria_id: g.categoria_id,
      obligacion_id: g.obligacion_id,
      descripcion: g.descripcion,
      medio_pago: g.medio_pago,
      valor_presupuestado: g.valor_presupuestado,
      fecha_limite: g.fecha_limite ? fechaEnPeriodo(periodo, Number(g.fecha_limite.slice(8, 10))) : null,
      notas: g.notas,
    }))
  if (filas.length) check(await supabase.from('gastos').insert(filas))
  if (ingresosMes.length === 0 && ingresosAnt.length) {
    check(await supabase.from('ingresos').insert(ingresosAnt.map((i) => ({ periodo, descripcion: i.descripcion, valor: i.valor }))))
  }
  return filas.length
}

export async function guardarMeta(m: Partial<Meta>) {
  const { id, ...rest } = m
  if (id) check(await supabase.from('metas').update(rest).eq('id', id).select())
  else check(await supabase.from('metas').insert(rest))
}

export async function eliminarMeta(id: string) {
  check(await supabase.from('metas').delete().eq('id', id))
}
