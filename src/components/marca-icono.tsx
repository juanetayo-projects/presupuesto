import { useState } from 'react'
import { Circle } from 'lucide-react'
import { ICONOS } from '@/components/category-icon'
import { useData } from '@/context/data'
import type { Gasto } from '@/lib/types'
import { cn } from '@/lib/utils'

/** URL del favicon oficial de la marca (servicio de favicons de Google, 128 px). */
export const urlLogo = (dominio: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio.trim())}&sz=128`

const TAM = {
  sm: { box: 'size-9', icono: 'size-4', logo: 'size-5' },
  md: { box: 'size-11', icono: 'size-5', logo: 'size-6' },
  lg: { box: 'size-13', icono: 'size-6', logo: 'size-8' },
}

interface Props {
  logo?: string | null
  icono?: string | null
  color: string
  size?: keyof typeof TAM
  className?: string
}

/**
 * Logo de la entidad (si tiene dominio y el favicon existe) sobre una placa blanca;
 * si no, un icono isométrico: cubo con cara superior en degradado del color de la
 * categoría, cantos laterales más oscuros y sombra proyectada.
 */
export function MarcaIcono({ logo, icono, color, size = 'md', className }: Props) {
  const [fallo, setFallo] = useState(false)
  const t = TAM[size]

  if (logo && !fallo) {
    return (
      <span className={cn(t.box, 'grid shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/10', className)}>
        <img
          src={urlLogo(logo)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn(t.logo, 'rounded-md object-contain')}
          // Google responde con un globo genérico de 16 px cuando no conoce el sitio: se trata como fallo
          onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setFallo(true)}
          onError={() => setFallo(true)}
        />
      </span>
    )
  }
  return <IconoIsometrico icono={icono} color={color} size={size} className={className} />
}

export function IconoIsometrico({ icono, color, size = 'md', className }: Omit<Props, 'logo'>) {
  const Icon = (icono && ICONOS[icono]) || Circle
  const t = TAM[size]
  return (
    <span className={cn(t.box, 'relative shrink-0', className)} aria-hidden>
      {/* plataforma en proyección isométrica (rombo) con cantos escalonados */}
      <span
        className="absolute inset-x-[14%] top-[46%] bottom-[-2%] rounded-[22%]"
        style={{
          transform: 'rotateX(60deg) rotateZ(45deg)',
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 35%, white) 0%, color-mix(in srgb, ${color} 70%, white) 100%)`,
          boxShadow: [1, 2, 3, 4].map((i) => `${i}px ${i}px 0 color-mix(in srgb, ${color} ${80 - i * 6}%, black)`).join(', '),
        }}
      />
      {/* objeto de pie sobre la plataforma: placa con degradado y sombra */}
      <span
        className="absolute inset-x-[22%] top-[2%] bottom-[30%] grid place-items-center rounded-[30%] shadow-[0_3px_4px_-1px_rgba(0,0,0,0.35)]"
        style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 70%, white) 0%, ${color} 45%, color-mix(in srgb, ${color} 75%, black) 100%)` }}
      >
        <span className="absolute inset-x-[12%] top-[8%] h-[30%] rounded-full bg-white/30" />
        <Icon className={cn(t.icono, 'relative scale-[0.82] text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]')} strokeWidth={2.5} />
      </span>
    </span>
  )
}

/** Icono de un gasto: logo/icono del concepto, si no el de su obligación, si no el de la categoría. */
export function IconoGasto({ g, size = 'md' }: { g: Gasto; size?: keyof typeof TAM }) {
  const { conceptos, obligaciones, catPorId } = useData()
  const k = g.concepto_id ? conceptos.find((c) => c.id === g.concepto_id) : undefined
  const o = g.obligacion_id ? obligaciones.find((x) => x.id === g.obligacion_id) : undefined
  const cat = catPorId.get(g.categoria_id)
  return <MarcaIcono logo={k?.logo ?? o?.logo} icono={k?.icono ?? cat?.icono} color={cat?.color ?? '#64748b'} size={size} />
}

/** "https://www.claro.com.co/hogar" → "www.claro.com.co" */
export const limpiarDominio = (s: string | null | undefined) =>
  (s ?? '').trim().replace(/^https?:\/\//i, '').split('/')[0] || null
