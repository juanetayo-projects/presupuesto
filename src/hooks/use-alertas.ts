import { useEffect, useMemo } from 'react'
import { useData } from '@/context/data'
import { hoyISO, money } from '@/lib/format'
import { urgencia } from '@/lib/metrics'

/**
 * Alertas de pago de todos los meses (no sólo el seleccionado):
 * vencidos, que vencen hoy y los que vencen dentro de `diasAlerta`.
 * Si el usuario dio permiso, envía una notificación del navegador una vez al día.
 */
export function useAlertasNavegador() {
  const { gastos, config } = useData()

  const alertas = useMemo(() => {
    return gastos
      .filter((g) => g.estado === 'pendiente' && g.fecha_limite)
      .map((g) => ({ g, u: urgencia(g, config.diasAlerta) }))
      .filter((x) => x.u === 'vencido' || x.u === 'hoy' || x.u === 'pronto')
      .sort((a, b) => a.g.fecha_limite!.localeCompare(b.g.fecha_limite!))
  }, [gastos, config.diasAlerta])

  const vencidos = alertas.filter((a) => a.u === 'vencido').length
  const hoy = alertas.filter((a) => a.u === 'hoy').length

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (vencidos + hoy === 0) return
    const clave = `ppto.notificado.${hoyISO()}`
    try {
      if (localStorage.getItem(clave)) return
      localStorage.setItem(clave, '1')
    } catch {
      return
    }
    const urgentes = alertas.filter((a) => a.u !== 'pronto')
    const total = urgentes.reduce((s, a) => s + Number(a.g.valor_presupuestado), 0)
    new Notification('Pagos pendientes', {
      body: `${vencidos} vencido(s) y ${hoy} para hoy · ${money(total)}\n${urgentes.slice(0, 3).map((a) => a.g.descripcion).join(', ')}`,
      icon: './icon.svg',
    })
  }, [alertas, vencidos, hoy])

  return { alertas, vencidos, hoy }
}
