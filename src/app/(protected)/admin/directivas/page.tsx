import { AdminDirectivasShell } from '@/components/directiva/AdminDirectivasShell'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function AdminDirectivasCamPage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }

  const puedeGestionar = await getPuedeGestionarCacheado(session.uid, session.email)

  return <AdminDirectivasShell puedeGestionar={puedeGestionar} />
}
