'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TEXTO_SUBTITULO_ADMIN_DIRECTIVAS_CAM } from '@/constants'
import { resolverClubIdDesdeParamClub } from '@/lib/club/slugUrlClub'
import { AppMainSection } from '@/components/layout/AppMainSection'
import { IconCalendar } from '@/components/layout/icons/NavIcons'
import { DirectivaClubPanel } from '@/components/directiva/DirectivaClubPanel'
import type { ClubCliente } from '@/types/club.types'

export interface AdminDirectivasShellProps {
  puedeGestionar: boolean
}

export function AdminDirectivasShell({ puedeGestionar }: AdminDirectivasShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const clubParam = (searchParams.get('club') ?? '').trim()

  const queryClubes = useQuery({
    queryKey: ['clubes', 'all'],
    queryFn: () => fetch('/api/clubes?all=true').then((res) => res.json()),
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

  const [clubId, setClubId] = useState('')

  useEffect(() => {
    if (!clubParam) {
      return
    }
    if (idDesdeUrl !== clubId) {
      setClubId(idDesdeUrl)
    }
  }, [clubParam, idDesdeUrl, clubId])

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

  const clubSeleccionado = clubes.find((c) => c.id === clubId)

  return (
    <AppMainSection
      title="Gestión de directivas CAM"
      subtitle={TEXTO_SUBTITULO_ADMIN_DIRECTIVAS_CAM}
      TitleIcon={IconCalendar}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="select-club-directiva" className="text-sm font-bold text-slate-800">
          Club
        </label>
        <select
          id="select-club-directiva"
          value={clubId}
          onChange={(e) => onChangeClub(e.target.value)}
          className="mt-2 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
        >
          <option value="">— Seleccione un club —</option>
          {clubes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.comuna ? ` · ${c.comuna}` : ''}
            </option>
          ))}
        </select>
        {clubSeleccionado ? (
          <p className="mt-2 text-xs text-slate-500">
            Directiva de <strong className="text-slate-700">{clubSeleccionado.nombre}</strong>
          </p>
        ) : null}
      </div>

      {!clubId ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 py-14 text-center text-sm text-slate-600">
          Elija un club para cargar o editar la directiva, lugar de reunión y cargos.
        </div>
      ) : (
        <div className="mt-6">
          <DirectivaClubPanel clubId={clubId} puedeGestionar={puedeGestionar} />
        </div>
      )}
    </AppMainSection>
  )
}
