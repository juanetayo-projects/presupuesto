import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Micro-animaciones de la app (modelo: "12 Motion Graphics with Opus 5.5", docs/modelo.mp4):
 * números que cuentan, píldora que se desliza entre pestañas, gauge con aguja y barras que "cargan".
 * Todas respetan "reducir movimiento" del sistema operativo.
 */

export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)'
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const fn = () => setReduce(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return reduce
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** Valor que cuenta desde el anterior hasta `value` (como el puntaje "13 → 98" del gauge). */
export function useCountUp(value: number, duration = 900) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  const desde = useRef(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      desde.current = value
      setN(value)
      return
    }
    const inicio = performance.now()
    const a = desde.current
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / duration)
      const v = a + (value - a) * easeOut(k)
      setN(v)
      desde.current = v
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    // Si la pestaña está oculta, requestAnimationFrame no corre: garantiza el valor final de todas formas.
    const fin = setTimeout(() => {
      cancelAnimationFrame(raf)
      desde.current = value
      setN(value)
    }, duration + 150)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fin)
    }
  }, [value, duration, reduce])
  return n
}

export function CountUp({ value, format, duration, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const n = useCountUp(value, duration)
  return <span className={cn('tabular-nums', className)}>{format(Math.round(n))}</span>
}

/** Ancho que pasa de 0 a `pct` al montarse y se anima en cada cambio (barra que "carga" como la batería). */
export function useCarga(pct: number) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.min(100, Math.max(0, pct))))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return w
}

export function BarraCarga({ pct, color, className, barClassName }: { pct: number; color?: string; className?: string; barClassName?: string }) {
  const w = useCarga(pct)
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('barra-carga h-full rounded-full', barClassName)} style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

interface Opcion<T extends string> {
  value: T
  label: ReactNode
}

/** Pestañas con una píldora que se desliza hasta la opción elegida ("Tab → switch"). */
export function SlidingTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: Opcion<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = ref.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value)}"]`)
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth })
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [value, options.length])
  return (
    <div ref={ref} role="tablist" className={cn('relative inline-flex items-center rounded-lg bg-muted p-0.5', className)}>
      {pill && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 left-0 rounded-md bg-primary shadow-sm transition-[transform,width] duration-300 ease-[cubic-bezier(.3,1.3,.5,1)] motion-reduce:transition-none"
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          data-value={o.value}
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 rounded-md font-medium whitespace-nowrap transition-colors duration-300',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
            o.value === value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Gauge semicircular con aguja que barre hasta el valor y número que cuenta ("Audit → 98").
 * `pct` puede pasar de 100 (gasto mayor que el ingreso): la aguja se detiene al final y el color pasa a rojo.
 */
export function Gauge({ pct, label, sub, size = 190 }: { pct: number; label: string; sub?: string; size?: number }) {
  const reduce = useReducedMotion()
  const n = useCountUp(pct, 1100)
  const k = Math.min(1, Math.max(0, n / 100))
  const color = pct > 90 ? '#e11d48' : pct > 75 ? '#f59e0b' : '#10b981'
  const r = 80
  const largo = Math.PI * r
  const ang = -90 + k * 180
  return (
    <div className="relative mx-auto" style={{ width: size }}>
      <svg viewBox="0 0 200 116" className="w-full overflow-visible" role="img" aria-label={`${label}: ${pct.toFixed(0)}%`}>
        <defs>
          <linearGradient id="gauge-g" x1="0" x2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--muted)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gauge-g)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - k)}
        />
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI * (1 - i / 10)
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 62}
              y1={100 - Math.sin(a) * 62}
              x2={100 + Math.cos(a) * (i % 5 === 0 ? 54 : 58)}
              y2={100 - Math.sin(a) * (i % 5 === 0 ? 54 : 58)}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeWidth={i % 5 === 0 ? 2 : 1}
            />
          )
        })}
        <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: '100px 100px', transition: reduce ? undefined : 'transform 120ms linear' }}>
          <line x1="100" y1="100" x2="100" y2="34" stroke="var(--foreground)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--card)" stroke="var(--foreground)" strokeWidth="3" />
      </svg>
      <div className="-mt-1 text-center">
        <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ color }}>
          {Math.round(n)}
          <span className="text-sm font-medium text-muted-foreground"> %</span>
        </p>
        <p className="text-xs font-medium">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}
