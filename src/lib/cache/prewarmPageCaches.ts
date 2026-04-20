import 'server-only'

import { unstable_cache } from 'next/cache'
import { TAG_CACHE_DASHBOARD_DATOS } from '@/lib/cache/dashboardDatos'
import { obtenerResumenPanelAdmin } from '@/services/panel-resumen.service'
import { listClubesTopBottomPorMiembros } from '@/services/club.service'

/**
 * Calienta en segundo plano los `unstable_cache` que usan las páginas del sidebar.
 * Se dispara fire-and-forget desde el layout para que la primera navegación
 * a cualquier página encuentre el cache ya poblado.
 */
export function prewarmPageCaches(uid: string, email?: string | null): void {
  const warmPanel = unstable_cache(
    () => obtenerResumenPanelAdmin(),
    ['prewarm-panel-v1'],
    { revalidate: 1800, tags: [TAG_CACHE_DASHBOARD_DATOS] },
  )

  const warmDashboard = unstable_cache(
    async () => {
      const [r, chartsClubes] = await Promise.all([
        obtenerResumenPanelAdmin(),
        listClubesTopBottomPorMiembros(10),
      ])
      return { r, chartsClubes }
    },
    ['dashboard-publico-v1'],
    { revalidate: 1800, tags: [TAG_CACHE_DASHBOARD_DATOS] },
  )

  const warmPuedeGestionar = async () => {
    const { getPuedeGestionarCacheado } = await import('@/lib/auth/sidebarProfile')
    return getPuedeGestionarCacheado(uid, email)
  }

  void Promise.all([warmPanel(), warmDashboard(), warmPuedeGestionar()]).catch(() => {})
}
