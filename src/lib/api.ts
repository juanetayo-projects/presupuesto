import { supabase } from './supabase'
import { fechaEnPeriodo, periodoMas } from './format'
import type { CierreMes, Concepto, Gasto, Ingreso, Meta, Movimiento, MovimientoInput, Obligacion } from './types'

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
  const [categorias, conceptos, obligaciones, gastos, ingresos, config, miembros, metas, cierres, movimientos] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('conceptos').select('*').order('orden'),
    supabase.from('v_obligaciones').select('*').order('nombre'),
    supabase.from('gastos').select('*').order('fecha_limite', { nullsFirst: false }),
    supabase.from('ingresos').select('*').order('periodo'),
    supabase.from('configuracion').select('*'),
    supabase.from('miembros').select('email,nombre').order('nombre'),
    supabase.from('metas').select('*').order('creado_en'),
    supabase.from('cierres_mes').select('*').order('periodo'),
    supabase.from('movimientos').select('*').order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
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
      responsables: (Array.isArray(cfg.responsables) ? cfg.responsables : ['Familiar', 'Pily', 'Juank']) as string[],
    },
    miembros: check(miembros) ?? [],
    metas: (check(metas) ?? []) as Meta[],
    cierres: (check(cierres) ?? []) as CierreMes[],
    movimientos: (check(movimientos) ?? []) as Movimiento[],
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
    .filter((c) => c.activo && c.recurrente && !yaEstan.has(c.id) && (!c.hasta_periodo || c.hasta_periodo >= periodo))
    .map((c) => ({
      periodo,
      concepto_id: c.id,
      categoria_id: c.categoria_id,
      obligacion_id: c.obligacion_id,
      descripcion: c.nombre,
      medio_pago: c.medio_pago,
      valor_presupuestado: c.valor_base,
      fecha_limite: fechaEnPeriodo(periodo, c.dia_limite),
      responsable: c.responsable,
    }))
  if (nuevos.length) check(await supabase.from('gastos').insert(nuevos))
  if (ingresosMes.length === 0) {
    check(await supabase.from('ingresos').insert({ periodo, descripcion: 'Ingreso base', tipo: 'Salario', valor: ingresoBase }))
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

/**
 * Pagar un compromiso del plan = registrar su movimiento real (en el mes de la fecha de pago).
 * La base marca el compromiso como pagado (trigger sincronizar_compromiso).
 */
export async function registrarPago(g: Gasto, valor: number, fecha: string, abono: number | null, pagadoPor: string | null) {
  check(
    await supabase.from('movimientos').insert({
      tipo: 'gasto',
      fecha,
      valor,
      categoria_id: g.categoria_id,
      descripcion: g.descripcion,
      medio_pago: g.medio_pago,
      responsable: g.responsable,
      gasto_id: g.id,
      obligacion_id: g.obligacion_id,
      abono_capital: abono,
      pagado_por: pagadoPor,
    }),
  )
}

/** Deshace el pago: borra su movimiento y el compromiso vuelve a pendiente. */
export async function deshacerPago(g: Gasto) {
  const { data } = await supabase.from('movimientos').select('id').eq('gasto_id', g.id)
  if (data?.length) check(await supabase.from('movimientos').delete().eq('gasto_id', g.id))
  // Compromisos pagados antes de existir los movimientos
  else await actualizarGasto(g.id, { estado: 'pendiente', valor_pagado: null, fecha_pago: null, abono_capital: null, pagado_por: null })
}

export async function guardarMovimiento(m: Partial<MovimientoInput> & { id?: string }) {
  const { id, ...rest } = m
  if (id) check(await supabase.from('movimientos').update(rest).eq('id', id).select())
  else check(await supabase.from('movimientos').insert(rest))
}

export async function eliminarMovimiento(id: string) {
  check(await supabase.from('movimientos').delete().eq('id', id))
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

/** Crea un ingreso; si meses > 1 lo repite en los meses siguientes con un mismo grupo. */
export async function crearIngresos(i: Pick<Ingreso, 'periodo' | 'descripcion' | 'tipo' | 'valor' | 'notas'>, meses = 1) {
  const grupo = meses > 1 ? crypto.randomUUID() : null
  const filas = Array.from({ length: meses }, (_, k) => ({ ...i, periodo: periodoMas(i.periodo, k), grupo }))
  check(await supabase.from('ingresos').insert(filas))
}

/** Borra los ingresos del grupo desde el mes indicado en adelante. */
export async function eliminarIngresosGrupo(grupo: string, desde: string) {
  check(await supabase.from('ingresos').delete().eq('grupo', grupo).gte('periodo', desde))
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
export async function copiarMesAnterior(periodo: string, anteriores: Gasto[], ingresosAnt: Ingreso[], ingresosMes: Ingreso[], conceptos: Concepto[] = []) {
  // No se copian ítems cuyo último mes ya pasó (p. ej. un préstamo que terminó)
  const terminados = new Set(conceptos.filter((c) => c.hasta_periodo && c.hasta_periodo < periodo).map((c) => c.id))
  const filas = anteriores
    .filter((g) => !g.grupo_cuotas && g.estado !== 'omitido' && !(g.concepto_id && terminados.has(g.concepto_id)))
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
      responsable: g.responsable,
    }))
  if (filas.length) check(await supabase.from('gastos').insert(filas))
  if (ingresosMes.length === 0 && ingresosAnt.length) {
    check(await supabase.from('ingresos').insert(ingresosAnt.map((i) => ({ periodo, descripcion: i.descripcion, tipo: i.tipo, valor: i.valor, notas: i.notas }))))
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

/**
 * Quita un ítem de la plantilla. Si ya tiene gastos registrados, éstos se conservan
 * (la referencia queda en blanco por la llave foránea "on delete set null").
 */
export async function eliminarConcepto(id: string) {
  check(await supabase.from('conceptos').delete().eq('id', id))
}

/** Cierra un mes: guarda la foto de sus totales y la base bloquea desde ya cualquier cambio en sus gastos e ingresos. */
export async function cerrarMes(periodo: string, resumen: CierreMes['resumen']) {
  check(await supabase.from('cierres_mes').upsert({ periodo, resumen }))
}

export async function reabrirMes(periodo: string) {
  check(await supabase.from('cierres_mes').delete().eq('periodo', periodo))
}
