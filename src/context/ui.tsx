import { createContext, useContext, useState, type ReactNode } from 'react'
import { GastoForm } from '@/components/gasto-form'
import { MovimientoForm, type MovimientoPreset } from '@/components/movimiento-form'
import { PagoDialog } from '@/components/pago-dialog'
import type { Gasto } from '@/lib/types'

interface UiState {
  /** Compromiso del plan (nuevo o existente). */
  abrirGasto: (g?: Gasto | null) => void
  /** Movimiento real: con `id` se edita; sin `id` son valores iniciales. */
  abrirMovimiento: (m?: MovimientoPreset | null) => void
  pagar: (g: Gasto) => void
}

const Ctx = createContext<UiState>(null!)

export function UiProvider({ children }: { children: ReactNode }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Gasto | null>(null)
  const [pagando, setPagando] = useState<Gasto | null>(null)
  const [movOpen, setMovOpen] = useState(false)
  const [movimiento, setMovimiento] = useState<MovimientoPreset | null>(null)
  const abrirMovimiento = (m?: MovimientoPreset | null) => {
    setMovimiento(m ?? null)
    setMovOpen(true)
  }

  const abrirGasto = (g?: Gasto | null) => {
    setEditando(g ?? null)
    setFormOpen(true)
  }

  return (
    <Ctx.Provider value={{ abrirGasto, abrirMovimiento, pagar: setPagando }}>
      {children}
      <GastoForm open={formOpen} onOpenChange={setFormOpen} gasto={editando} />
      <PagoDialog gasto={pagando} onClose={() => setPagando(null)} />
      <MovimientoForm open={movOpen} onOpenChange={setMovOpen} movimiento={movimiento} />
    </Ctx.Provider>
  )
}

export const useUi = () => useContext(Ctx)
