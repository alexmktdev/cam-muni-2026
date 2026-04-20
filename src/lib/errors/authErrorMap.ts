// Maps Firebase Auth (and related) errors to safe Spanish UI messages.

import type { AuthError } from '@/types/authentication.types'

function codeFromText(text: string): string | null {
  const apiMatch = text.match(/\bapi\/[a-z0-9-]+\b/i)
  if (apiMatch) {
    return apiMatch[0].toLowerCase()
  }
  const authMatch = text.match(/\bauth\/[a-z0-9_-]+\b/i)
  return authMatch ? authMatch[0] : null
}

function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>
    const direct = o.code
    if (typeof direct === 'string' && direct.length > 0) {
      return direct
    }
    if (o.cause !== undefined && o.cause !== error) {
      const inner = extractErrorCode(o.cause)
      if (inner !== 'desconocido') {
        return inner
      }
    }
  }
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return 'api/red-cliente'
  }
  const text =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (text) {
    const fromMsg = codeFromText(text)
    if (fromMsg) {
      return fromMsg
    }
  }
  return 'desconocido'
}

/** Turns Firebase (or fetch) errors into a code + user-safe Spanish message. */
export function mapAuthError(error: unknown): AuthError {
  const codigo = extractErrorCode(error)
  const map: Record<string, string> = {
    'auth/user-not-found': 'No existe una cuenta con ese correo',
    'auth/wrong-password': 'La contraseña es incorrecta',
    'auth/invalid-credential':
      'Correo o contraseña incorrectos. Si la cuenta la dio de alta otra persona, pide que confirme en Firebase Authentication que el usuario exista y que el método «Correo/contraseña» esté activado.',
    'auth/invalid-login-credentials': 'La contraseña es incorrecta',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos',
    'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacta al administrador',
    'auth/invalid-email': 'El correo ingresado no es válido',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
    'auth/unauthorized-domain':
      'Este dominio no está autorizado. En Firebase: Authentication → Configuración → Dominios autorizados, añade el host exacto de la barra de direcciones: localhost, 127.0.0.1 o tu IP local (p. ej. 192.168.x.x), y el puerto que muestre `npm run dev` (3000, 3001, etc.).',
    'auth/operation-not-allowed':
      'Correo y contraseña no está habilitado. En Firebase: Authentication → Método de acceso → Correo/contraseña.',
    'auth/network-request-failed': 'Sin conexión o red bloqueada. Comprueba internet y vuelve a intentar.',
    'api/token-id-no-verificado':
      'El navegador inició sesión en Firebase, pero el servidor no pudo validar el token. Muy frecuente: tenías el emulador de Auth y ahora no (o al revés). En `.env.local` deja `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` vacío o `false` para producción; si usas emulador, define también `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` y reinicia `npm run dev`. Comprueba que `FIREBASE_ID_PROYECTO` y `NEXT_PUBLIC_FIREBASE_PROJECT_ID` sean el mismo.',
    'api/sesion-servidor':
      'El servidor no pudo crear la cookie de sesión. En local: revisa la terminal de `npm run dev`. En Vercel: revisa los logs del deployment. Causas frecuentes: clave privada Admin mal pegada, `FIREBASE_*` y `NEXT_PUBLIC_FIREBASE_PROJECT_ID` de distinto proyecto, o fallo al generar la sesión en Firebase (mira el log `createSessionCookie`).',
    'api/no-encontrado':
      'No se encontró la ruta de la API. Reinicia `npm run dev` y prueba de nuevo.',
    'api/error-servidor': 'El servidor respondió con error al crear la sesión. Mira la terminal para el detalle.',
    'api/red-cliente':
      'El navegador no pudo llamar a tu propio servidor. Abre la misma URL que indica la terminal (p. ej. http://localhost:3001 si el 3000 está ocupado). Revisa extensiones o firewall.',
    'api/login-bloqueado':
      'Acceso temporalmente bloqueado por múltiples intentos fallidos. Usa "¿Olvidaste tu contraseña?" o espera unos minutos.',
  }
  const mensaje = map[codigo] ?? 'Ocurrió un error. Intenta de nuevo'
  return { codigo, mensaje }
}

/** Pista solo para consola en desarrollo (no mostrar en UI). */
export function hintDiagnosticoAuth(codigo: string): string | null {
  if (codigo !== 'auth/invalid-credential' && codigo !== 'auth/invalid-login-credentials') {
    return null
  }
  return (
    'Mismo error con datos «correctos»: en Firebase Console → Authentication comprueba que el usuario exista; Sign-in method → Email/Password habilitado. En .env: NEXT_PUBLIC_FIREBASE_PROJECT_ID debe coincidir con FIREBASE_ID_PROYECTO (mismo proyecto que la cuenta de servicio). Opcional: añade APP_ID, MESSAGING_SENDER_ID y STORAGE_BUCKET del snippet web.'
  )
}

/** Short technical summary for dev logs (no secrets). */
export function formatErrorForDebug(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}
