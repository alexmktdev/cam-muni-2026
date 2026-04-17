// Panel principal: resumen `aggregates/panel` + gráficos (clubes; stats RUT desde panel, sin barrer miembros_club).

import Link from 'next/link'
import { ROUTES, TEXTO_SUBTITULO_PANEL } from '@/constants'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardRutStatsCallout } from '@/components/dashboard/DashboardRutStatsCallout'
import { AppMainSection } from '@/components/layout/AppMainSection'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { obtenerDatosDashboardPublicosCacheados } from '@/lib/cache/obtenerDashboardPublicoCacheado'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function DashboardPage() {
  const session = await readVerifiedSession()
  const puedeActualizarStatsRut = session
    ? await getPuedeGestionarCacheado(session.uid, session.email)
    : false

  const { r, chartsClubes } = await obtenerDatosDashboardPublicosCacheados()
  const statsPersonas = r.statsRut ?? { unicos: 0, duplicados: 0 }
  const statsRutEnPanel = r.statsRut !== null

  const totalTodos = r.totalClubes
  const totalActivos = r.totalClubesActivos
  const totalMiembros = r.totalMiembros

  const topClubes = chartsClubes.top
  const bottomClubes = chartsClubes.bottom

  const clubesActivosCount = r.totalClubesActivos
  const clubesInactivosCount = Math.max(0, r.totalClubes - r.totalClubesActivos)

  return (
    <AppMainSection title="Panel de Control" subtitle={TEXTO_SUBTITULO_PANEL}>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{totalTodos}</p>
          <p className="text-sm font-semibold text-slate-700">Clubes registrados</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{totalActivos}</p>
          <p className="text-sm font-semibold text-slate-700">Clubes activos</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{totalMiembros}</p>
          <p className="text-sm font-semibold text-slate-700">Miembros (suma por club)</p>
        </div>
      </div>
      <p className="mb-6 text-xs leading-relaxed text-slate-500">
        Estos totales vienen de un resumen en Firestore (se actualiza al crear o borrar clubes y al
        cambiar miembros). Si algo no cuadra, use{' '}
        <strong className="text-slate-600">Alinear contadores de miembros</strong> en{' '}
        <Link href={ROUTES.adminClubes} className="font-semibold text-blue-800 underline">
          Gestión de clubes
        </Link>{' '}
        para recalcular desde los datos reales.
      </p>

      <DashboardRutStatsCallout
        statsRutEnPanel={statsRutEnPanel}
        puedeActualizar={puedeActualizarStatsRut}
      />

      <h2 className="mb-4 text-base font-bold text-slate-800">Indicadores gráficos</h2>
      <DashboardCharts
        topClubes={topClubes}
        bottomClubes={bottomClubes}
        statsPersonas={{
          unicos: statsPersonas.unicos,
          duplicados: statsPersonas.duplicados,
        }}
        statsRutSonAproximados={!statsRutEnPanel}
        clubesActivoInactivo={{
          activos: clubesActivosCount,
          inactivos: clubesInactivosCount,
        }}
      />
    </AppMainSection>
  )
}
