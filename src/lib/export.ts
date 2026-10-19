import { nombreMes } from './format'
import { porCategoria, resumen, valorGasto } from './metrics'
import { TIPOS_OBLIGACION, type Categoria, type Gasto, type Ingreso, type ObligacionVista } from './types'

/** Excel del mes con 3 hojas: Resumen, Gastos y Deudas. xlsx se carga sólo al exportar. */
export async function exportarMesExcel(periodo: string, gastos: Gasto[], ingresos: Ingreso[], categorias: Categoria[], obligaciones: ObligacionVista[]) {
  const XLSX = await import('xlsx')
  const catPorId = new Map(categorias.map((c) => [c.id, c.nombre]))
  const r = resumen(gastos, ingresos)
  const cats = porCategoria(gastos, categorias)

  const hojaResumen = XLSX.utils.aoa_to_sheet([
    ['Presupuesto familia Etayo-Murillo'],
    [nombreMes(periodo)],
    [],
    ['Ingreso', r.ingreso],
    ['Total gastos', r.total],
    ['Pagado', r.pagado],
    ['Por pagar', r.pendiente],
    ['Disponible', r.disponible],
    [],
    ['Categoría', 'Valor', '% del total de gastos'],
    ...cats.map((c) => [c.nombre, c.valor, Number((c.pct / 100).toFixed(4))]),
  ])
  hojaResumen['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }]

  const hojaGastos = XLSX.utils.json_to_sheet(
    gastos.map((g) => ({
      Categoría: catPorId.get(g.categoria_id) ?? '',
      Concepto: g.descripcion,
      Cuota: g.cuotas_total ? `${g.cuota_num}/${g.cuotas_total}` : '',
      'Medio de pago': g.medio_pago ?? '',
      Presupuestado: Number(g.valor_presupuestado),
      Pagado: g.valor_pagado == null ? '' : Number(g.valor_pagado),
      '% del total': r.total ? Number((valorGasto(g) / r.total).toFixed(4)) : 0,
      'Fecha límite': g.fecha_limite ?? '',
      'Fecha de pago': g.fecha_pago ?? '',
      Estado: g.estado,
      'Pagado por': g.pagado_por ?? '',
      Notas: g.notas ?? '',
    })),
  )
  hojaGastos['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 7 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 30 }]

  const hojaDeudas = XLSX.utils.json_to_sheet(
    obligaciones.map((o) => ({
      Obligación: o.nombre,
      Entidad: o.entidad ?? '',
      Tipo: TIPOS_OBLIGACION[o.tipo],
      'Saldo inicial': o.saldo_inicial == null ? '' : Number(o.saldo_inicial),
      'Total pagado': Number(o.total_pagado),
      'Saldo actual': o.saldo_actual == null ? '' : Number(o.saldo_actual),
      Cuota: Number(o.cuota ?? 0),
      'Cuotas pagadas': o.cuotas_pagadas,
    })),
  )

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen')
  XLSX.utils.book_append_sheet(libro, hojaGastos, 'Gastos')
  XLSX.utils.book_append_sheet(libro, hojaDeudas, 'Deudas')
  XLSX.writeFile(libro, `presupuesto-${periodo.slice(0, 7)}.xlsx`)
}
