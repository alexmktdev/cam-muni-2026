'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppMainSection } from '@/components/layout/AppMainSection'
import {
  IconDuplicate,
  IconFingerprint,
  IconListRows,
  IconSearch,
  IconUsersTwo,
} from '@/components/layout/icons/NavIcons'
import { Button } from '@/components/ui/Button'
import type { RespuestaBusquedaConsolidada } from '@/services/busqueda-miembros.service'

/** Formatea RUT sin puntos ni guion a formato 12.345.678-9 */
function formatearRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()
  return body.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.') + '-' + dv
}

export interface StatsInicialesBusqueda {
  total: number
  unicos: number
  duplicados: number
  /** true si `aggregates/panel.statsRut` está presente; false requiere recomputar. */
  statsRutEnPanel: boolean
}

export interface BusquedaMiembrosViewProps {
  statsIniciales: StatsInicialesBusqueda
}

/**
 * Página de Búsqueda Global de Miembros.
 * Totales inmediatos desde `aggregates/panel` (1 lectura). La lista consolidada
 * completa solo se carga al presionar «Buscar» o «Ver Todos» (lazy).
 */
export function BusquedaMiembrosView({ statsIniciales }: BusquedaMiembrosViewProps) {
  const [data, setData] = useState<RespuestaBusquedaConsolidada | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false)
  const [showList, setShowList] = useState(false)
  const [pagina, setPagina] = useState(1)
  const PAGE_SIZE = 10

  async function fetchConsolidadoSiHaceFalta() {
    if (data) {
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/admin/miembros/consolidado', {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('fallo')
      }
      const json = (await res.json()) as RespuestaBusquedaConsolidada
      setData(json)
    } catch (err) {
      console.error('Fallo al cargar base consolidada:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPagina(1)
  }, [searchQuery, showOnlyDuplicates])

  const filteredMiembros = useMemo(() => {
    if (!data) return []
    let result = data.miembros

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      if (q === 'duplicado' || q === 'duplicados') {
        result = result.filter((m) => m.esDuplicado)
      } else if (q === 'unico' || q === 'unicos' || q === 'único' || q === 'únicos') {
        result = result.filter((m) => !m.esDuplicado)
      } else {
        result = result.filter(
          (m) =>
            m.nombreCompleto.toLowerCase().includes(q) ||
            m.rut.toLowerCase().includes(q),
        )
      }
    }

    if (showOnlyDuplicates) {
      result = result.filter((m) => m.esDuplicado)
    }

    return result
  }, [data, searchQuery, showOnlyDuplicates])

  const totalResultados = filteredMiembros.length
  const totalPaginas = Math.max(1, Math.ceil(totalResultados / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)

  const pagedList = useMemo(() => {
    const start = (paginaSegura - 1) * PAGE_SIZE
    return filteredMiembros.slice(start, start + PAGE_SIZE)
  }, [filteredMiembros, paginaSegura])

  const mostrandoDesde = totalResultados === 0 ? 0 : (paginaSegura - 1) * PAGE_SIZE + 1
  const mostrandoHasta = Math.min(paginaSegura * PAGE_SIZE, totalResultados)

  const stats = useMemo(() => {
    if (data) {
      return {
        total: data.stats.total,
        unicos: data.stats.unicos,
        duplicados: data.stats.duplicados,
        mostrando: filteredMiembros.length,
      }
    }
    return {
      total: statsIniciales.total,
      unicos: statsIniciales.unicos,
      duplicados: statsIniciales.duplicados,
      mostrando: 0,
    }
  }, [data, filteredMiembros, statsIniciales])

  const handleVerTodos = async () => {
    setSearchQuery('')
    setShowOnlyDuplicates(false)
    await fetchConsolidadoSiHaceFalta()
    setShowList(true)
  }

  const handleBuscar = async () => {
    await fetchConsolidadoSiHaceFalta()
    setShowList(true)
  }

  const handleLimpiar = () => {
    setSearchQuery('')
    setShowOnlyDuplicates(false)
    setShowList(false)
  }

  return (
    <AppMainSection
      title="Búsqueda de Miembros"
      subtitle="Consulta miembros por RUT o nombre y visualiza su pertenencia a clubes"
      TitleIcon={IconUsersTwo}
    >
      <div className="space-y-6">
        {!statsIniciales.statsRutEnPanel ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Los totales mostrados pueden no estar actualizados. Para recalcular
            únicos/duplicados globales, vaya al panel de control y use
            «Actualizar stats RUT».
          </div>
        ) : null}

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Buscar por Nombre, RUT, Duplicado o Único
              </label>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej: RUT, nombre, duplicado o único..."
                  className="h-12 w-full rounded-lg border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleBuscar()
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleBuscar()}
                variant="primary"
                className="h-12 px-8"
                disabled={loading}
              >
                {loading ? 'Cargando…' : 'Buscar'}
              </Button>
              <Button
                onClick={() => void handleVerTodos()}
                variant="emerald"
                className="h-12 px-8 shadow-md"
                disabled={loading}
              >
                {loading ? 'Cargando…' : 'Ver Todos'}
              </Button>
              <Button
                variant="ghost"
                onClick={handleLimpiar}
                className="h-12 border border-slate-200"
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="TOTAL"
            value={stats.total}
            label="Miembros encontrados"
            icon={IconUsersTwo}
            color="blue"
          />
          <StatCard
            title="DUPLICADOS"
            value={stats.duplicados}
            label="En varios clubes"
            icon={IconDuplicate}
            color="amber"
          />
          <StatCard
            title="ÚNICOS"
            value={stats.unicos}
            label="Solo en uno"
            icon={IconFingerprint}
            color="green"
          />
          <StatCard
            title="MOSTRANDO"
            value={stats.mostrando}
            label="Bajo filtros actuales"
            icon={IconListRows}
            color="indigo"
          />
        </div>

        {showList && data ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)}
              className={`flex items-center gap-2 px-4 shadow-sm ${
                showOnlyDuplicates
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <IconDuplicate className="h-4 w-4" />
              {showOnlyDuplicates ? 'Viendo solo duplicados' : 'Filtrar duplicados'}
            </Button>
          </div>
        ) : null}

        {!showList ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
            <IconSearch className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-600">
              Ningún miembro seleccionado
            </h3>
            <p className="max-w-xs text-sm text-slate-400">
              Ingresa un nombre/RUT arriba o presiona «Ver Todos» para desplegar
              el listado completo.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Resultados de búsqueda
                </h3>
                <p className="text-xs text-slate-500">
                  Mostrando {mostrandoDesde} a {mostrandoHasta} de {totalResultados} resultados
                </p>
              </div>
              <div className="text-xs font-medium text-slate-500">
                Página <span className="font-bold text-slate-800">{paginaSegura}</span> de {totalPaginas}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">RUT</th>
                    <th className="px-6 py-4">Nombre</th>
                    <th className="px-6 py-4">Clubes Asociados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                          <span className="text-sm font-medium text-slate-500">
                            Cargando base masiva...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : pagedList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400">
                        No se encontraron miembros para el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    pagedList.map((miembro, idx) => (
                      <tr
                        key={miembro.rut}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4 text-xs font-medium text-slate-400">
                          {(paginaSegura - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                              miembro.esDuplicado
                                ? 'border border-rose-200 bg-rose-100 text-rose-700'
                                : 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {miembro.esDuplicado ? 'Duplicado' : 'Único'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-bold tabular-nums text-slate-700">
                          {formatearRut(miembro.rut)}
                        </td>
                        <td className="px-6 py-4 text-sm font-extrabold uppercase text-slate-900">
                          {miembro.nombreCompleto}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {miembro.clubes.map((club) => (
                              <span
                                key={club.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[0.7rem] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                              >
                                {club.nombre}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Mostrando <span className="font-bold text-slate-900">{mostrandoDesde}</span> a{' '}
                  <span className="font-bold text-slate-900">{mostrandoHasta}</span> de{' '}
                  <span className="font-bold text-slate-900">{totalResultados}</span>{' '}
                  resultados
                </p>
                <nav className="flex flex-wrap items-center gap-1" aria-label="Paginación">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaSegura === 1}
                    className="!w-auto"
                  >
                    Anterior
                  </Button>

                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter((n) => {
                      if (totalPaginas <= 7) return true
                      return (
                        n === 1 ||
                        n === totalPaginas ||
                        Math.abs(n - paginaSegura) <= 1
                      )
                    })
                    .map((n, idx, arr) => {
                      const prev = arr[idx - 1]
                      const showEllipsis = prev != null && n - prev > 1
                      return (
                        <div key={n} className="flex items-center gap-1">
                          {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                          <button
                            type="button"
                            onClick={() => setPagina(n)}
                            className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-bold shadow-sm transition ${
                              paginaSegura === n
                                ? 'bg-indigo-600 text-white shadow-indigo-200'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {n}
                          </button>
                        </div>
                      )
                    })}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaSegura === totalPaginas}
                    className="!w-auto"
                  >
                    Siguiente
                  </Button>
                </nav>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppMainSection>
  )
}

type StatCardColor = 'blue' | 'amber' | 'green' | 'indigo'

function StatCard({
  title,
  value,
  label,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  label: string
  icon: (props: { className?: string }) => React.ReactElement
  color: StatCardColor
}) {
  const colors: Record<StatCardColor, string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    green: 'text-green-600 bg-green-50 border-green-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-slate-400">
          {title}
        </span>
        <div className={`rounded-lg border p-2 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tabular-nums tracking-tight text-slate-900">
          {value.toLocaleString()}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}
