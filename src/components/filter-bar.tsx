import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FILTROS_VACIOS, useData } from '@/context/data'

export function FilterBar({ buscar = true }: { buscar?: boolean }) {
  const { filtros, setFiltros, categorias, gastos } = useData()
  const medios = useMemo(() => [...new Set(gastos.map((g) => g.medio_pago ?? 'Sin medio'))].sort(), [gastos])
  const activos =
    filtros.categoria !== 'todas' || filtros.medio !== 'todos' || filtros.estado !== 'todos' || filtros.texto !== ''

  return (
    <div className="space-y-2" data-slot="filtros">
      <div className="flex flex-wrap gap-2">
        {buscar && (
          <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar concepto…"
              className="pl-8"
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            />
          </div>
        )}
        <Select value={filtros.categoria} onValueChange={(v) => setFiltros({ ...filtros, categoria: v })}>
          <SelectTrigger className="min-w-0 flex-1 sm:w-48 sm:flex-none">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtros.medio} onValueChange={(v) => setFiltros({ ...filtros, medio: v })}>
          <SelectTrigger className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <SelectValue placeholder="Medio de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los medios</SelectItem>
            {medios.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activos && (
          <Button variant="ghost" size="icon" aria-label="Limpiar filtros" onClick={() => setFiltros(FILTROS_VACIOS)}>
            <X />
          </Button>
        )}
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        value={filtros.estado}
        onValueChange={(v) => setFiltros({ ...filtros, estado: v || 'todos' })}
      >
        <ToggleGroupItem value="todos" className="flex-1 sm:flex-none">Todos</ToggleGroupItem>
        <ToggleGroupItem value="pendiente" className="flex-1 sm:flex-none">Pendientes</ToggleGroupItem>
        <ToggleGroupItem value="vencido" className="flex-1 sm:flex-none">Vencidos</ToggleGroupItem>
        <ToggleGroupItem value="pagado" className="flex-1 sm:flex-none">Pagados</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
