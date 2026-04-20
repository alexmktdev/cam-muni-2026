// Verifies session on the server before rendering protected routes (in addition to middleware).

import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants'
import { ProtectedAppShellClient } from '@/components/layout/ProtectedAppShellClient'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await readVerifiedSession()
  if (!session) {
    const next = encodeURIComponent(ROUTES.login)
    redirect(`/api/auth/clear-session-cookie?next=${next}`)
  }

  return <ProtectedAppShellClient>{children}</ProtectedAppShellClient>
}
