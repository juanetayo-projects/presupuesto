import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { cargarTodo } from '@/lib/api'
import { periodoActual } from '@/lib/format'
import type { Categoria, Concepto, Gasto, Ingreso, Meta, Miembro, ObligacionVista } from '@/lib/types'

export interface Filtros {
  categoria: string // 'todas' | id
  medio: string // 'todos' | medio
  estado: string // 'todos' | 'pendiente' | 'pagado' | 'vencido'
  texto: string
}

export const FILTROS_VACIOS: Filtros = { categoria: 'todas', medio: 'todos', estado: 'todos', texto: '' }

interface DataState {
  loading: boolean
  categorias: Categoria[]
  conceptos: Concepto[]
  obligaciones: ObligacionVista[]
  gastos: Gasto[]
  ingresos: Ingreso[]
  miembros: Miembro[]
  metas: Meta[]
  config: { ingresoBase: number; diasAlerta: number; pctImprevistos: number }
  periodo: string
  setPeriodo: (p: string) => void
  filtros: Filtros
  setFiltros: (f: Filtros) => void
  recargar: () => Promise<void>
  catPorId: Map<string, Categoria>
}

const Ctx = createContext<DataState>(null!)

const leerPeriodo = () => {
  try {
    return localStorage.getItem('ppto.periodo') || periodoActual()
  } catch {
    return periodoActual()
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof cargarTodo>> | null>(null)
  const [periodo, setPeriodoState] = useState(leerPeriodo)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)

  const recargar = useCallback(async () => {
    try {
      setData(await cargarTodo())
    } catch (e) {
      toast.error('No se pudieron cargar los datos', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  const setPeriodo = (p: string) => {
    setPeriodoState(p)
    try {
      localStorage.setItem('ppto.periodo', p)
    } catch {
      /* sin almacenamiento local */
    }
  }

  const catPorId = useMemo(() => new Map((data?.categorias ?? []).map((c) => [c.id, c])), [data?.categorias])

  const value: DataState = {
    loading,
    categorias: data?.categorias ?? [],
    conceptos: data?.conceptos ?? [],
    obligaciones: data?.obligaciones ?? [],
    gastos: data?.gastos ?? [],
    ingresos: data?.ingresos ?? [],
    miembros: data?.miembros ?? [],
    metas: data?.metas ?? [],
    config: data?.config ?? { ingresoBase: 6600000, diasAlerta: 5, pctImprevistos: 5 },
    periodo,
    setPeriodo,
    filtros,
    setFiltros,
    recargar,
    catPorId,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
