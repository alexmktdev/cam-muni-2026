'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { resolverClubIdDesdeParamClub } from '@/lib/club/slugUrlClub'
import {
  IconPencil,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconUser,
  IconUsersTwo,
} from '@/components/layout/icons/NavIcons'
import { EditarMiembroClubModal } from '@/components/miembros-club/EditarMiembroClubModal'
import { ImportarCsvMiembrosClubModal } from '@/components/miembros-club/ImportarCsvMiembrosClubModal'
import { EliminarMiembroClubModal } from '@/components/miembros-club/EliminarMiembroClubModal'
import { NuevoMiembroClubModal } from '@/components/miembros-club/NuevoMiembroClubModal'
import { VaciarMiembrosClubModal } from '@/components/miembros-club/VaciarMiembrosClubModal'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import type { ClubCliente } from '@/types/club.types'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

const PAGE_SIZE = 10

function nombreCompletoMiembro(m: MiembroClubCliente): string {
  const parts = [m.nombre?.trim(), m.apellidos?.trim()].filter(Boolean)
  return parts.join(' ') || '—'
}

function inicialesAvatarMiembro(m: MiembroClubCliente): string {
  const c = (m.nombre || m.apellidos || '').trim().charAt(0)
  return c ? c.toUpperCase() : '👤'
}

function ordenarMiembros(list: MiembroClubCliente[]): MiembroClubCliente[] {
  return [...list].sort((a, b) =>
    `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es', {
      sensitivity: 'base',
    }),
  )
}

type RespuestaMiembrosApi = {
  miembros: MiembroClubCliente[]
  total: number
  nextCursor?: string | null
}

type FiltrosUI = {
  edadMin: string
  edadMax: string
  sector: string
  fechaDesde: string
  fechaHasta: string
}

const FILTROS_VACIOS: FiltrosUI = {
  edadMin: '',
  edadMax: '',
  sector: '',
  fechaDesde: '',
  fechaHasta: '',
}

function filtrosToParams(f: FiltrosUI): URLSearchParams {
  const p = new URLSearchParams()
  if (f.edadMin) p.set('edadMin', f.edadMin)
  if (f.edadMax) p.set('edadMax', f.edadMax)
  if (f.sector) p.set('sector', f.sector)
  if (f.fechaDesde) p.set('fechaDesde', f.fechaDesde)
  if (f.fechaHasta) p.set('fechaHasta', f.fechaHasta)
  return p
}

function hayFiltrosActivos(f: FiltrosUI): boolean {
  return Object.values(f).some((v) => v.trim() !== '')
}

async function fetchMiembrosPagina(
  clubId: string,
  page: number,
  limit: number,
  filtros: FiltrosUI,
  cursor?: string,
): Promise<RespuestaMiembrosApi> {
  const params = new URLSearchParams({
    clubId,
    page: String(page),
    limit: String(limit),
  })
  if (cursor) {
    params.set('cursor', cursor)
  }
  for (const [k, v] of filtrosToParams(filtros).entries()) {
    params.set(k, v)
  }
  const res = await fetch(`/api/miembros-club?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error('Error al cargar miembros')
  }
  const data = (await res.json()) as { miembros?: MiembroClubCliente[]; total?: number; nextCursor?: string | null }
  return {
    miembros: data.miembros || [],
    total: typeof data.total === 'number' ? data.total : 0,
    nextCursor: data.nextCursor ?? null,
  }
}

async function fetchMiembrosBusqueda(
  clubId: string,
  q: string,
  filtros: FiltrosUI,
): Promise<RespuestaMiembrosApi> {
  const params = new URLSearchParams({ clubId, q })
  for (const [k, v] of filtrosToParams(filtros).entries()) {
    params.set(k, v)
  }
  const res = await fetch(`/api/miembros-club?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error('Error al cargar miembros')
  }
  const data = (await res.json()) as { miembros?: MiembroClubCliente[] }
  const miembros = data.miembros || []
  return { miembros, total: miembros.length }
}

export interface MiembrosClubViewProps {
  puedeGestionar: boolean
}

export function MiembrosClubView({
  puedeGestionar,
}: MiembrosClubViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const clubParam = (searchParams.get('club') ?? '').trim()

  const queryClubes = useQuery({
    queryKey: ['clubes', 'all'],
    queryFn: () => fetch('/api/clubes?all=true').then(res => res.json()),
  })

  const clubes: ClubCliente[] = Array.isArray(queryClubes.data?.clubes)
    ? queryClubes.data.clubes
    : []

  const idDesdeUrl = useMemo(() => {
    if (!clubes.length || !clubParam) {
      return ''
    }
    return resolverClubIdDesdeParamClub(clubParam, clubes)
  }, [clubes, clubParam])

  const filtrosId = useId()
  const [clubId, setClubId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filtros, setFiltros] = useState<FiltrosUI>(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const cursoresRef = useRef<Map<number, string>>(new Map())

  /** Sincroniza el club seleccionado con `?club=` en cada navegación (id, slug u otro valor que resuelva el mapa). */
  useEffect(() => {
    if (!clubParam) {
      return
    }
    if (idDesdeUrl !== clubId) {
      setClubId(idDesdeUrl)
    }
  }, [clubParam, idDesdeUrl, clubId])

  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalCsv, setModalCsv] = useState(false)
  const [modalVaciarClub, setModalVaciarClub] = useState(false)
  const [sincronizandoContador, setSincronizandoContador] = useState(false)
  const [editando, setEditando] = useState<MiembroClubCliente | null>(null)
  const [eliminar, setEliminar] = useState<MiembroClubCliente | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [pendingEliminar, setPendingEliminar] = useState(false)
  const [normalizando, setNormalizando] = useState(false)
  const [previewNorm, setPreviewNorm] = useState<{ antes: string; despues: string }[] | null>(null)
  const [normMsg, setNormMsg] = useState<string | null>(null)

  // Debounce para evitar ráfagas de lecturas en Firestore al escribir (Backend-First)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  const modoBusqueda = debouncedQuery.trim() !== ''

  const filtrosKey = JSON.stringify(filtros)

  const cursorParaPagina = pagina > 1 ? cursoresRef.current.get(pagina) : undefined

  const queryMiembros = useQuery({
    queryKey: modoBusqueda
      ? ['miembros', clubId, 'busqueda', debouncedQuery, filtrosKey]
      : ['miembros', clubId, 'pagina', pagina, filtrosKey],
    queryFn: async () => {
      if (modoBusqueda) {
        return fetchMiembrosBusqueda(clubId, debouncedQuery.trim(), filtros)
      }
      const result = await fetchMiembrosPagina(clubId, pagina, PAGE_SIZE, filtros, cursorParaPagina)
      if (result.nextCursor) {
        cursoresRef.current.set(pagina + 1, result.nextCursor)
      }
      return result
    },
    enabled: Boolean(clubId),
  })

  const refetch = queryMiembros.refetch

  useEffect(() => {
    setPagina(1)
    cursoresRef.current.clear()
  }, [clubId, debouncedQuery])

  const clubSeleccionado = clubes.find((c) => c.id === clubId)
  const totalMiembrosReferencia = clubSeleccionado?.miembros ?? 0

  const listaOrdenadaBusqueda = useMemo(() => {
    if (!modoBusqueda || !queryMiembros.data?.miembros) {
      return []
    }
    return ordenarMiembros(queryMiembros.data.miembros)
  }, [modoBusqueda, queryMiembros.data])

  const totalResultadosListado = modoBusqueda
    ? listaOrdenadaBusqueda.length
    : (queryMiembros.data?.total ?? 0)

  const totalPaginas = Math.max(1, Math.ceil(totalResultadosListado / PAGE_SIZE))

  const paginaSegura = Math.min(pagina, totalPaginas)

  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas))
  }, [totalPaginas])

  const filas = useMemo(() => {
    if (modoBusqueda) {
      const start = (paginaSegura - 1) * PAGE_SIZE
      return listaOrdenadaBusqueda.slice(start, start + PAGE_SIZE)
    }
    return ordenarMiembros(queryMiembros.data?.miembros ?? [])
  }, [modoBusqueda, listaOrdenadaBusqueda, paginaSegura, queryMiembros.data])

  const muestraCargando = queryMiembros.isLoading
  const isPlaceholderData = queryMiembros.isFetching && !queryMiembros.isLoading
  const botonesActivos = Boolean(clubId) && !muestraCargando

  function onChangeClub(id: string) {
    setClubId(id)
    if (id) {
      const c = clubes.find((x) => x.id === id)
      const enUrl = c?.slugUrl ?? id
      router.replace(`${pathname}?club=${encodeURIComponent(enUrl)}`, { scroll: false })
    } else {
      router.replace(pathname, { scroll: false })
    }
  }

  const recargarActual = useCallback(async () => {
    await refetch()
  }, [refetch])

  async function onSincronizarContadorMiembros() {
    if (!clubId || sincronizandoContador) {
      return
    }
    setSincronizandoContador(true)
    try {
      const res = await fetch('/api/miembros-club/sincronizar-contador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clubId }),
      })
      if (!res.ok) {
        return
      }
      queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
      router.refresh()
    } finally {
      setSincronizandoContador(false)
    }
  }

  const mostrandoDesde = totalResultadosListado === 0 ? 0 : (paginaSegura - 1) * PAGE_SIZE + 1
  const mostrandoHasta = Math.min(paginaSegura * PAGE_SIZE, totalResultadosListado)

  async function previsualizarNormalizacion() {
    if (!clubId || normalizando) return
    setNormalizando(true)
    setNormMsg(null)
    try {
      const res = await fetch('/api/miembros-club/normalizar-nombres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clubId, aplicar: false }),
      })
      if (!res.ok) { setNormMsg('Error al obtener preview'); return }
      const data = (await res.json()) as { cambios: { antes: string; despues: string }[]; modificados: number }
      if (data.modificados === 0) {
        setNormMsg('Todos los nombres ya están normalizados.')
        setPreviewNorm(null)
      } else {
        setPreviewNorm(data.cambios)
      }
    } finally {
      setNormalizando(false)
    }
  }

  async function aplicarNormalizacion() {
    if (!clubId || normalizando) return
    setNormalizando(true)
    try {
      const res = await fetch('/api/miembros-club/normalizar-nombres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clubId, aplicar: true }),
      })
      if (!res.ok) { setNormMsg('Error al aplicar'); return }
      const data = (await res.json()) as { modificados: number }
      setNormMsg(`Se normalizaron ${data.modificados} registro(s).`)
      setPreviewNorm(null)
      queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
    } finally {
      setNormalizando(false)
    }
  }


  async function confirmarEliminar() {
    const m = eliminar
    if (!m) {
      return
    }
    setPendingEliminar(true)
    setErrorEliminar(null)
    try {
      const res = await fetch(`/api/miembros-club/${encodeURIComponent(m.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setErrorEliminar(err?.error ?? 'No se pudo eliminar')
        return
      }

      // Invalidar caché para forzar recarga suave
      queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
      setEliminar(null)
    } finally {
      setPendingEliminar(false)
    }
  }

  return (
    <div className={`flex flex-col gap-6 transition-opacity duration-300 ${isPlaceholderData ? 'opacity-60' : 'opacity-100'}`}>
      <NuevoMiembroClubModal
        open={modalNuevo}
        clubId={clubId}
        onClose={() => setModalNuevo(false)}
        onCreado={() => {
          // Recarga instantánea vía caché
          queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
        }}
      />
      <ImportarCsvMiembrosClubModal
        open={modalCsv}
        clubId={clubId}
        onClose={() => setModalCsv(false)}
        onImportado={() => {
          queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
        }}
      />
      <VaciarMiembrosClubModal
        open={modalVaciarClub}
        clubId={clubId}
        nombreClub={clubSeleccionado?.nombre ?? 'este club'}
        onClose={() => setModalVaciarClub(false)}
        onVaciado={() => {
          queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
          router.refresh()
        }}
      />
      <EditarMiembroClubModal
        miembro={editando}
        onClose={() => setEditando(null)}
        onGuardado={() => {
          queryClient.invalidateQueries({ queryKey: ['miembros', clubId] })
        }}
      />
      <EliminarMiembroClubModal
        miembro={eliminar}
        loading={pendingEliminar}
        error={errorEliminar}
        onClose={() => {
          setEliminar(null)
          setErrorEliminar(null)
        }}
        onConfirm={() => void confirmarEliminar()}
      />

      {normMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {normMsg}
          <button type="button" onClick={() => setNormMsg(null)} className="ml-3 text-xs font-semibold underline">Cerrar</button>
        </div>
      ) : null}

      {previewNorm ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">
            Preview de normalización ({previewNorm.length} cambios)
          </h3>
          <div className="mt-3 max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="px-2 py-1">Antes</th>
                  <th className="px-2 py-1">Después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {previewNorm.slice(0, 50).map((c, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-red-700 line-through">{c.antes}</td>
                    <td className="px-2 py-1 font-medium text-emerald-800">{c.despues}</td>
                  </tr>
                ))}
                {previewNorm.length > 50 ? (
                  <tr>
                    <td colSpan={2} className="px-2 py-1 text-slate-500">
                      …y {previewNorm.length - 50} más
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={normalizando}
              onClick={() => void aplicarNormalizacion()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {normalizando ? 'Aplicando…' : 'Aplicar normalización'}
            </button>
            <button
              type="button"
              onClick={() => setPreviewNorm(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="select-club-miembros" className="text-sm font-bold text-slate-800">
          Club
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <select
              id="select-club-miembros"
              value={clubId}
              onChange={(e) => onChangeClub(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
            >
              <option value="">— Seleccione un club —</option>
              {clubes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.comuna ? ` · ${c.comuna}` : ''}
                </option>
              ))}
            </select>
          </div>
          {puedeGestionar ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={!botonesActivos}
                onClick={() => setModalNuevo(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconUser className="h-5 w-5 shrink-0" aria-hidden />
                Agregar miembro
              </button>
              <button
                type="button"
                disabled={!botonesActivos}
                onClick={() => setModalCsv(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconUpload className="h-5 w-5 shrink-0 text-blue-800" aria-hidden />
                Importar CSV (un club)
              </button>
              <button
                type="button"
                disabled={!clubId || sincronizandoContador}
                onClick={() => void onSincronizarContadorMiembros()}
                title="Iguala el contador del club con los registros reales en esta pestaña"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconRefresh
                  className={`h-5 w-5 shrink-0 ${sincronizandoContador ? 'animate-spin' : ''}`}
                  aria-hidden
                />
                {sincronizandoContador ? 'Actualizando…' : 'Actualizar contador del club'}
              </button>
              <button
                type="button"
                disabled={!botonesActivos || normalizando}
                onClick={() => void previsualizarNormalizacion()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/90 px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {normalizando ? 'Procesando…' : 'Normalizar nombres'}
              </button>
              <button
                type="button"
                disabled={!botonesActivos}
                onClick={() => setModalVaciarClub(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconTrash className="h-5 w-5 shrink-0" aria-hidden />
                Eliminar todos los miembros del club
              </button>
            </div>
          ) : null}
        </div>
        {clubSeleccionado ? (
          <p className="mt-3 text-xs text-slate-500">
            Mostrando miembros de <strong className="text-slate-700">{clubSeleccionado.nombre}</strong>
            {muestraCargando
              ? ' · Cargando…'
              : modoBusqueda
                ? ` · ${totalResultadosListado} resultado(s) (muestra hasta 200 registros del club por consulta)`
                : ` · ${queryMiembros.data?.total ?? totalMiembrosReferencia} en base · página ${paginaSegura} de ${totalPaginas}`}
          </p>
        ) : null}
      </div>

      {!clubId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 py-16 text-center">
          <IconUsersTwo className="h-14 w-14 text-slate-300" aria-hidden />
          <p className="mt-4 max-w-sm text-sm text-slate-600">
            Elija un club en el menú desplegable para ver y administrar sus miembros.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre completo o RUT…"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
              aria-label="Buscar miembros"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-blue-900/15 bg-white shadow-md ring-1 ring-blue-900/10">
            <div className="p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                className="inline-flex max-w-full items-center gap-2.5 rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Filtros avanzados
                {hayFiltrosActivos(filtros) ? (
                  <span className="inline-block rounded-full bg-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-950 shadow-sm">
                    Activos
                  </span>
                ) : null}
                <span className="text-base leading-none text-white/90" aria-hidden>
                  {filtrosAbiertos ? '▲' : '▼'}
                </span>
              </button>
            </div>
            {filtrosAbiertos ? (
              <div className="border-t border-slate-100 px-4 pb-4 pt-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${filtrosId}-edadMin`} className="text-xs font-medium text-slate-600">Edad mínima</label>
                    <input
                      id={`${filtrosId}-edadMin`}
                      type="number"
                      min="0"
                      max="150"
                      value={filtros.edadMin}
                      onChange={(e) => setFiltros((f) => ({ ...f, edadMin: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      placeholder="Ej: 60"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${filtrosId}-edadMax`} className="text-xs font-medium text-slate-600">Edad máxima</label>
                    <input
                      id={`${filtrosId}-edadMax`}
                      type="number"
                      min="0"
                      max="150"
                      value={filtros.edadMax}
                      onChange={(e) => setFiltros((f) => ({ ...f, edadMax: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      placeholder="Ej: 80"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${filtrosId}-sector`} className="text-xs font-medium text-slate-600">Sector</label>
                    <input
                      id={`${filtrosId}-sector`}
                      type="text"
                      value={filtros.sector}
                      onChange={(e) => setFiltros((f) => ({ ...f, sector: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      placeholder="Ej: Villa"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${filtrosId}-fechaDesde`} className="text-xs font-medium text-slate-600">Nacimiento desde</label>
                    <input
                      id={`${filtrosId}-fechaDesde`}
                      type="date"
                      value={filtros.fechaDesde}
                      onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${filtrosId}-fechaHasta`} className="text-xs font-medium text-slate-600">Nacimiento hasta</label>
                    <input
                      id={`${filtrosId}-fechaHasta`}
                      type="date"
                      value={filtros.fechaHasta}
                      onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>
                {hayFiltrosActivos(filtros) ? (
                  <button
                    type="button"
                    onClick={() => setFiltros(FILTROS_VACIOS)}
                    className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {muestraCargando ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                      <th className="w-14 px-3 py-3 text-center">#</th>
                      <th className="px-4 py-3">Nombre completo</th>
                      <th className="px-4 py-3">RUT</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Edad</th>
                      <th className="hidden px-4 py-3 md:table-cell">Teléfono</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Sector</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRowSkeleton key={i} columns={7} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : modoBusqueda && totalResultadosListado === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Ningún resultado coincide con la búsqueda.
              </p>
            ) : !modoBusqueda && !queryMiembros.isLoading && totalResultadosListado === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No hay miembros registrados en este club.
              </p>
            ) : filas.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No hay miembros en esta página.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                      <th className="w-14 px-3 py-3 text-center">#</th>
                      <th className="px-4 py-3">Nombre completo</th>
                      <th className="px-4 py-3">RUT</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Edad</th>
                      <th className="hidden px-4 py-3 md:table-cell">Teléfono</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Sector</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map((m, idx) => (
                      <tr key={m.id} className="text-slate-800">
                        <td className="px-3 py-3 text-center tabular-nums text-slate-500">
                          {(paginaSegura - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 shadow-sm"
                              aria-hidden="true"
                            >
                              {inicialesAvatarMiembro(m)}
                            </div>
                            <span className="font-medium text-slate-900">{nombreCompletoMiembro(m)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">{m.rutFormateado}</td>
                        <td className="hidden px-4 py-3 tabular-nums text-slate-600 lg:table-cell">
                          {m.edad != null ? `${m.edad} años` : '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {m.telefono || '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                          {m.sector || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {puedeGestionar ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditando(m)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                              >
                                <IconPencil className="h-3.5 w-3.5" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEliminar(m)
                                  setErrorEliminar(null)
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                                Eliminar
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {clubId && !muestraCargando && totalResultadosListado > 0 ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Mostrando {mostrandoDesde} a {mostrandoHasta} de {totalResultadosListado} resultados
              </p>
              <nav className="flex flex-wrap items-center gap-1" aria-label="Paginación">
                <button
                  type="button"
                  disabled={paginaSegura <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((n) => {
                    if (totalPaginas <= 7) {
                      return true
                    }
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
                      <span key={n} className="flex items-center gap-1">
                        {showEllipsis ? (
                          <span className="px-1 text-slate-400" aria-hidden>
                            …
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setPagina(n)}
                          className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-bold shadow-sm transition ${paginaSegura === n
                              ? 'bg-blue-800 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          {n}
                        </button>
                      </span>
                    )
                  })}
                <button
                  type="button"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </nav>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
