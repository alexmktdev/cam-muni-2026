import 'server-only'

import { revalidateTag, unstable_cache } from 'next/cache'
import {
  PERFIL_PLACEHOLDER_INICIALES,
  PERFIL_PLACEHOLDER_NOMBRE,
} from '@/constants'
import { getAdminAuth } from '@/lib/firebase/adminFirebase'
import { getUserProfileForSidebar, nombreVisibleDesdePerfil } from '@/services/user.service'

export type SidebarProfile = {
  nombre: string
  iniciales: string
  /** Rol desde Firestore `users.role` (si existe). */
  rol?: string
}

function etiquetaRolParaUi(role: string): string {
  return role.trim().replace(/_/g, ' ')
}

function inicialesDesdeNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) {
    const a = partes[0]?.[0] ?? ''
    const b = partes[1]?.[0] ?? ''
    return (a + b).toUpperCase()
  }
  if (partes.length === 1 && partes[0]!.length >= 2) {
    return partes[0]!.slice(0, 2).toUpperCase()
  }
  return PERFIL_PLACEHOLDER_INICIALES
}

function nombreDesdeCorreo(email: string): string {
  const local = email.split('@')[0]?.trim() ?? ''
  if (!local) {
    return PERFIL_PLACEHOLDER_NOMBRE
  }
  return local
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

async function resolverPerfilSidebarInterno(
  uid: string,
  emailSesion?: string | null,
): Promise<SidebarProfile> {
  try {
    const perfilFs = await getUserProfileForSidebar(uid, emailSesion)
    const desdeFirestore = nombreVisibleDesdePerfil(perfilFs)
    const rolFs = perfilFs?.role?.trim() ? etiquetaRolParaUi(perfilFs.role) : undefined

    if (desdeFirestore) {
      return {
        nombre: desdeFirestore,
        iniciales: inicialesDesdeNombre(desdeFirestore),
        rol: rolFs,
      }
    }

    const authUser = await getAdminAuth().getUser(uid)
    const conNombre =
      authUser.displayName?.trim() ||
      (authUser.email ? nombreDesdeCorreo(authUser.email) : '') ||
      PERFIL_PLACEHOLDER_NOMBRE

    return {
      nombre: conNombre,
      iniciales: inicialesDesdeNombre(conNombre),
      rol: rolFs,
    }
  } catch {
    return {
      nombre: PERFIL_PLACEHOLDER_NOMBRE,
      iniciales: PERFIL_PLACEHOLDER_INICIALES,
    }
  }
}

/**
 * Perfil para sidebar: Firestore por uid o por email, luego Auth.
 * Cache de Next (varios minutos) para no releer `users` en cada navegación del layout.
 */
export async function getSidebarProfileForSession(
  uid: string,
  emailSesion?: string | null,
): Promise<SidebarProfile> {
  const emailKey = (emailSesion ?? '').trim().toLowerCase()
  return unstable_cache(
    () => resolverPerfilSidebarInterno(uid, emailSesion),
    ['sidebar-profile-v2', uid, emailKey],
    { revalidate: 300, tags: [`sidebar-user-${uid}`] },
  )()
}

export function invalidarCacheSidebarUsuario(uid: string): void {
  try {
    revalidateTag(`sidebar-user-${uid}`)
  } catch {
    // Solo en runtime Next.
  }
}

/**
 * Resuelve si el usuario puede gestionar (crear/editar/borrar) recursos.
 * Cacheado 300 s para evitar releer `users` en cada navegación de page.
 */
export async function getPuedeGestionarCacheado(
  uid: string,
  emailSesion?: string | null,
): Promise<boolean> {
  const { canManageUsers } = await import('@/lib/auth/canManageUsers')
  return unstable_cache(
    async () => {
      const perfil = await getUserProfileForSidebar(uid, emailSesion)
      return canManageUsers(perfil?.role)
    },
    ['puede-gestionar-v1', uid],
    { revalidate: 300, tags: [`sidebar-user-${uid}`] },
  )()
}
