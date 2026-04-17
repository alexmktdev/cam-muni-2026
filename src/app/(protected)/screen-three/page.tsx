// Alta de usuario: formulario en tarjeta; creación vía API (rol admin por defecto).

import { NuevoUsuarioForm } from '@/components/usuarios/NuevoUsuarioForm'
import { AppMainSection } from '@/components/layout/AppMainSection'
import { TEXTO_SUBTITULO_NUEVO_USUARIO } from '@/constants'
import { getPuedeGestionarCacheado } from '@/lib/auth/sidebarProfile'
import { readVerifiedSession } from '@/lib/session/readSession'

export default async function ScreenThreePage() {
  const session = await readVerifiedSession()
  if (!session) {
    return null
  }
  const puedeCrear = await getPuedeGestionarCacheado(session.uid, session.email)

  return (
    <AppMainSection
      showHeader={false}
      title="Nuevo Usuario"
      subtitle={TEXTO_SUBTITULO_NUEVO_USUARIO}
    >
      <NuevoUsuarioForm puedeCrear={puedeCrear} />
    </AppMainSection>
  )
}
