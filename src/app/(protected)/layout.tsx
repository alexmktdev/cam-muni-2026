// Verifies session on the server before rendering protected routes (in addition to middleware).

import { dehydrate, QueryClient } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants'
import { AppShellLayout } from '@/components/layout/AppShellLayout'
import { HydrateClubesCatalogo } from '@/components/providers/HydrateClubesCatalogo'
import { getSidebarProfileForSession } from '@/lib/auth/sidebarProfile'
import { obtenerClubesCatalogoCacheado } from '@/lib/cache/obtenerClubesCatalogoCacheado'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await readVerifiedSession()
  if (!session) {
    const next = encodeURIComponent(ROUTES.login)
    redirect(`/api/auth/clear-session-cookie?next=${next}`)
  }

  const [perfil, clubes] = await Promise.all([
    getSidebarProfileForSession(session.uid, session.email),
    obtenerClubesCatalogoCacheado(),
  ])

  const queryClient = new QueryClient()
  queryClient.setQueryData(['clubes', 'all'], { clubes })
  const dehydratedState = dehydrate(queryClient)

  return (
    <HydrateClubesCatalogo state={dehydratedState}>
      <AppShellLayout
        nombreUsuario={perfil.nombre}
        inicialesUsuario={perfil.iniciales}
        rolUsuario={perfil.rol}
      >
        {children}
      </AppShellLayout>
    </HydrateClubesCatalogo>
  )
}
