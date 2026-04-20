'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  PERFIL_PLACEHOLDER_INICIALES,
  PERFIL_PLACEHOLDER_NOMBRE,
} from '@/constants'
import { AppShellLayout } from '@/components/layout/AppShellLayout'
import { QUERY_KEY_SHELL_PERFIL } from '@/lib/query/shellProfileQueryKey'

type PerfilShellResp = {
  nombre: string
  iniciales: string
  rol?: string
}

async function fetchShellPerfil(): Promise<{ perfil: PerfilShellResp }> {
  const res = await fetch('/api/shell-context', { credentials: 'include' })
  if (!res.ok) {
    throw new Error('No se pudo cargar el perfil')
  }
  return (await res.json()) as { perfil: PerfilShellResp }
}

async function fetchClubesCatalogo(): Promise<{ clubes: unknown[] }> {
  const res = await fetch('/api/clubes', { credentials: 'include' })
  if (!res.ok) {
    throw new Error('No se pudo cargar clubes')
  }
  return (await res.json()) as { clubes: unknown[] }
}

export function ProtectedAppShellClient({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: QUERY_KEY_SHELL_PERFIL,
    queryFn: fetchShellPerfil,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  /** Una sola carga en el cliente (no en el RSC del layout): alinea caché con vistas que usan `['clubes','all']`. */
  useQuery({
    queryKey: ['clubes', 'all'],
    queryFn: fetchClubesCatalogo,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const perfil = data?.perfil

  return (
    <AppShellLayout
      nombreUsuario={perfil?.nombre ?? PERFIL_PLACEHOLDER_NOMBRE}
      inicialesUsuario={perfil?.iniciales ?? PERFIL_PLACEHOLDER_INICIALES}
      rolUsuario={perfil?.rol}
    >
      {children}
    </AppShellLayout>
  )
}
