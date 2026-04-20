import { ROUTES } from '@/constants'

export function esRutaProtegida(ruta: string): boolean {
  if (ruta === ROUTES.dashboard || ruta.startsWith(`${ROUTES.dashboard}/`)) {
    return true
  }
  if (ruta === ROUTES.screenTwo || ruta.startsWith(`${ROUTES.screenTwo}/`)) {
    return true
  }
  if (ruta === ROUTES.screenThree || ruta.startsWith(`${ROUTES.screenThree}/`)) {
    return true
  }
  if (ruta === '/admin' || ruta.startsWith('/admin/')) {
    return true
  }
  return false
}

export function esRutaAutenticacion(ruta: string): boolean {
  return (
    ruta === ROUTES.login ||
    ruta.startsWith(`${ROUTES.login}/`) ||
    ruta === ROUTES.forgotPassword ||
    ruta.startsWith(`${ROUTES.forgotPassword}/`)
  )
}
