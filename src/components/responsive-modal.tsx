import { useEffect, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

export function useIsDesktop() {
  const q = '(min-width: 768px)'
  const [ok, setOk] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const fn = () => setOk(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return ok
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Acción secundaria a la izquierda del pie (p. ej. Eliminar). */
  footerStart?: ReactNode
  /** Ancho en escritorio: los formularios largos usan 'lg' para repartir campos en columnas y evitar scroll. */
  ancho?: 'md' | 'lg'
}

/** Diálogo centrado en escritorio, hoja inferior deslizable en el celular. */
export function ResponsiveModal({ open, onOpenChange, title, description, children, footer, footerStart, ancho = 'md' }: Props) {
  const desktop = useIsDesktop()
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={ancho === 'lg' ? 'max-h-[94vh] gap-3 overflow-y-auto sm:max-w-3xl' : 'max-h-[94vh] gap-3 overflow-y-auto sm:max-w-lg'}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {(footer || footerStart) && (
            <DialogFooter className="items-center sm:justify-between">
              <div className="flex gap-2">{footerStart}</div>
              <div className="flex gap-2">{footer}</div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[96dvh]">
        <DrawerHeader className="py-2 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">{children}</div>
        {(footer || footerStart) && (
          <DrawerFooter className="flex-row flex-wrap gap-2 py-3 [&>*]:flex-1">
            {footerStart}
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
