// Gestión de usuarios: datos desde Firestore (servidor); acciones sensibles vía API.

import Link from 'next/link'
import { ROUTES } from '@/constants'
import { UsersManagementView } from '@/components/usuarios/UsersManagementView'
import { AppMainSection } from '@/components/layout/AppMainSection'
import { IconUsersTwo } from '@/components/layout/icons/NavIcons'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { readVerifiedSession } from '@/lib/session/readSession'
import { obtenerUsuariosListadoCacheados } from '@/lib/cache/usersListCatalog'
import { mapUsuarioListadoToCliente } from '@/services/user.service'

export default async function ScreenTwoPage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }
  const puedeGestionar = await getPuedeGestionarCacheado(session.uid, session.email)

  const usuarios = await obtenerUsuariosListadoCacheados()
  const initialUsers = usuarios.map(mapUsuarioListadoToCliente)

  return (
    <AppMainSection
      title="Gestión de Usuarios"
      subtitle="Administre los usuarios del sistema"
      TitleIcon={IconUsersTwo}
      actions={
        <Link
          href={ROUTES.screenThree}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900 sm:w-auto sm:justify-start"
        >
          <span aria-hidden>+</span>
          Nuevo Usuario
        </Link>
      }
    >
      <UsersManagementView
        initialUsers={initialUsers}
        puedeGestionar={puedeGestionar}
        miUsuarioId={session.uid}
      />
    </AppMainSection>
  )
}
