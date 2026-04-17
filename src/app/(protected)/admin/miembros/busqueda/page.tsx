// Búsqueda global de miembros: totales desde `aggregates/panel` (1 lectura);
// la base consolidada completa solo se carga al presionar Buscar/Ver Todos.

import { unstable_cache } from 'next/cache'
import { BusquedaMiembrosView } from '@/components/miembros/BusquedaMiembrosView'
import { TAG_CACHE_DASHBOARD_DATOS } from '@/lib/cache/dashboardDatos'
import { readVerifiedSession } from '@/lib/session/readSession'
import { obtenerResumenPanelAdmin } from '@/services/panel-resumen.service'

const panelCacheadoBusqueda = unstable_cache(
  () => obtenerResumenPanelAdmin(),
  ['panel-busqueda-miembros-v1'],
  { revalidate: 1800, tags: [TAG_CACHE_DASHBOARD_DATOS] },
)

export default async function BusquedaMiembrosPage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }

  const panel = await panelCacheadoBusqueda()

  const statsIniciales = panel.statsRut
    ? {
        total: panel.statsRut.unicos + panel.statsRut.duplicados,
        unicos: panel.statsRut.unicos,
        duplicados: panel.statsRut.duplicados,
        statsRutEnPanel: true,
      }
    : {
        total: 0,
        unicos: 0,
        duplicados: 0,
        statsRutEnPanel: false,
      }

  return <BusquedaMiembrosView statsIniciales={statsIniciales} />
}
