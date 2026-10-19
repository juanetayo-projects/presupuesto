import { useMemo } from 'react'
import { FilterX, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FILTROS_VACIOS, useData, useFiltros } from '@/context/data'
import { cn } from '@/lib/utils'

const activo = 'border-primary/60 bg-primary/10 text-primary font-medium'
const itemEstado = 'flex-1 sm:flex-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary'

export function FilterBar({ pagina, buscar = true }: { pagina: string; buscar?: boolean }) {
  const { categorias, gastos, config } = useData()
  const [filtros, setFiltros] = useFiltros(pagina)
  const medios = useMemo(() => [...new Set(gastos.map((g) => g.medio_pago ?? 'Sin medio'))].sort(), [gastos])
  const nActivos =
    Number(filtros.categoria !== 'todas') + Number(filtros.medio !== 'todos') + Number((filtros.responsable ?? 'todos') !== 'todos') + Number(filtros.estado !== 'todos') + Number(filtros.texto.trim() !== '')

  return (
    <div className="space-y-2" data-slot="filtros">
      <div className="flex flex-wrap gap-2">
        {buscar && (
          <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar concepto…"
              className={cn('pr-8 pl-8', filtros.texto && 'border-primary/60')}
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            />
            {filtros.texto && (
              <button
                aria-label="Borrar búsqueda"
                onClick={() => setFiltros({ ...filtros, texto: '' })}
                className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        <Select value={filtros.categoria} onValueChange={(v) => setFiltros({ ...filtros, categoria: v })}>
          <SelectTrigger className={cn('min-w-0 flex-1 sm:w-52 sm:flex-none', filtros.categoria !== 'todas' && activo)}>
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
        <Select value={filtros.responsable ?? 'todos'} onValueChange={(v) => setFiltros({ ...filtros, responsable: v })}>
          <SelectTrigger className={cn('min-w-0 flex-1 sm:w-40 sm:flex-none', (filtros.responsable ?? 'todos') !== 'todos' && activo)}>
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las personas</SelectItem>
            {config.responsables.map((r) => (
              <SelectItem key={r} value={r}>
                {r === 'Familiar' ? 'Gasto familiar' : `Gastos ${r}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtros.medio} onValueChange={(v) => setFiltros({ ...filtros, medio: v })}>
          <SelectTrigger className={cn('min-w-0 flex-1 sm:w-44 sm:flex-none', filtros.medio !== 'todos' && activo)}>
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          value={filtros.estado}
          onValueChange={(v) => setFiltros({ ...filtros, estado: v || 'todos' })}
        >
          <ToggleGroupItem value="todos" className={itemEstado}>Todos</ToggleGroupItem>
          <ToggleGroupItem value="pendiente" className={itemEstado}>Pendientes</ToggleGroupItem>
          <ToggleGroupItem value="vencido" className={itemEstado}>Vencidos</ToggleGroupItem>
          <ToggleGroupItem value="pagado" className={itemEstado}>Pagados</ToggleGroupItem>
        </ToggleGroup>
        {nActivos > 0 && (
          <Button variant="outline" size="sm" className="border-primary/50 text-primary" onClick={() => setFiltros(FILTROS_VACIOS)}>
            <FilterX /> Limpiar filtros ({nActivos})
          </Button>
        )}
      </div>
    </div>
  )
}
