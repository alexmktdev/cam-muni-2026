// Gestión de clubes: datos desde Firestore (servidor); alta y baja vía API.

import { unstable_cache } from 'next/cache'
import { AdminClubesShell } from '@/components/clubes/AdminClubesShell'
import { TAG_CACHE_DASHBOARD_DATOS } from '@/lib/cache/dashboardDatos'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { readVerifiedSession } from '@/lib/session/readSession'
import { obtenerResumenPanelAdmin } from '@/services/panel-resumen.service'

const panelCacheado = unstable_cache(
  () => obtenerResumenPanelAdmin(),
  ['panel-admin-clubes-v1'],
  { revalidate: 300, tags: [TAG_CACHE_DASHBOARD_DATOS] },
)

export default async function AdminClubesPage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }

  const [puedeGestionar, panel] = await Promise.all([
    getPuedeGestionarCacheado(session.uid, session.email),
    panelCacheado(),
  ])

  return (
    <AdminClubesShell
      initialTotales={{
        totalClubes: panel.totalClubes,
        totalClubesActivos: panel.totalClubesActivos,
        totalMiembros: panel.totalMiembros,
      }}
      puedeGestionar={puedeGestionar}
    />
  )
}
