import 'server-only'

import { unstable_cache } from 'next/cache'
import { TAG_CACHE_DASHBOARD_DATOS } from '@/lib/cache/dashboardDatos'
import { listClubesTopBottomPorMiembros } from '@/services/club.service'
import { obtenerResumenPanelAdmin } from '@/services/panel-resumen.service'

/** Panel + gráficos de clubes; compartido entre visitas (app administrativa single-tenant). */
export async function obtenerDatosDashboardPublicosCacheados() {
  return unstable_cache(
    async () => {
      const [r, chartsClubes] = await Promise.all([
        obtenerResumenPanelAdmin(),
        listClubesTopBottomPorMiembros(10),
      ])
      return { r, chartsClubes }
    },
    ['dashboard-publico-v1'],
    { revalidate: 1800, tags: [TAG_CACHE_DASHBOARD_DATOS] },
  )()
}
