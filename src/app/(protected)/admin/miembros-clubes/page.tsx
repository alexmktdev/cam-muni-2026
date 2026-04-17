// Miembros por club: selector, tabla, alta, importación CSV y edición (API + Firestore).

import { AdminMiembrosShell } from '@/components/miembros-club/AdminMiembrosShell'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function AdminMiembrosClubesPage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }

  const puedeGestionar = await getPuedeGestionarCacheado(session.uid, session.email)

  return (
    <AdminMiembrosShell
      puedeGestionar={puedeGestionar}
    />
  )
}
