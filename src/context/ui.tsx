import { createContext, useContext, useState, type ReactNode } from 'react'
import { GastoForm } from '@/components/gasto-form'
import { PagoDialog } from '@/components/pago-dialog'
import type { Gasto } from '@/lib/types'

interface UiState {
  abrirGasto: (g?: Gasto | null) => void
  pagar: (g: Gasto) => void
}

const Ctx = createContext<UiState>(null!)

export function UiProvider({ children }: { children: ReactNode }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Gasto | null>(null)
  const [pagando, setPagando] = useState<Gasto | null>(null)

  const abrirGasto = (g?: Gasto | null) => {
    setEditando(g ?? null)
    setFormOpen(true)
  }

  return (
    <Ctx.Provider value={{ abrirGasto, pagar: setPagando }}>
      {children}
      <GastoForm open={formOpen} onOpenChange={setFormOpen} gasto={editando} />
      <PagoDialog gasto={pagando} onClose={() => setPagando(null)} />
    </Ctx.Provider>
  )
}

export const useUi = () => useContext(Ctx)
