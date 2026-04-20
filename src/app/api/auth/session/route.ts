// POST: crear cookie de sesión a partir de idToken (emitido en el cliente tras email/contraseña).
// DELETE: cerrar sesión y revocar tokens.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { decodeJwtPayloadUnsafe } from '@/lib/auth/jwtPayloadDebug'
import { getAdminAuth } from '@/lib/firebase/adminFirebase'
import { clearLoginFailures, getClientIpFromHeaders } from '@/lib/security/loginAttemptPolicy'
import { createSessionCookieFromIdToken } from '@/lib/session/createSession'
import { closeServerSession } from '@/lib/session/closeSession'

/**
 * El login con email/contraseña se hace en el navegador (Firebase Client SDK).
 * Llamar a Identity Toolkit desde el servidor con la misma API key web suele devolver
 * INVALID_LOGIN_CREDENTIALS si la clave tiene restricción por referrer HTTP.
 */
const postBodySchema = z.object({
  idToken: z.string().min(1),
})

const UNAUTHORIZED = 'No autorizado'

/** firebase-admin requiere Node (no Edge). */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown
    const parsed = postBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: UNAUTHORIZED, code: 'api/sesion-servidor' }, { status: 401 })
    }
    const { idToken } = parsed.data
    const ip = getClientIpFromHeaders(request.headers)

    const auth = getAdminAuth()
    let email: string
    try {
      // checkRevoked: false evita una llamada extra a Firebase; el token acaba de emitirse en el login.
      const decoded = await auth.verifyIdToken(idToken, false)
      const mail = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : ''
      if (!mail) {
        return NextResponse.json({ error: UNAUTHORIZED, code: 'api/sesion-servidor' }, { status: 401 })
      }
      email = mail
    } catch (err: unknown) {
      const fb = err as { code?: string; message?: string }
      console.error(
        'POST /api/auth/session verifyIdToken',
        fb?.code ?? 'sin-codigo',
        fb?.message ?? err,
      )
      const payload = decodeJwtPayloadUnsafe(idToken)
      if (payload?.aud) {
        console.error(
          '[diagnóstico] aud del idToken (proyecto Firebase en el JWT):',
          payload.aud,
          '| FIREBASE_ID_PROYECTO en servidor:',
          process.env.FIREBASE_ID_PROYECTO ?? '(no definido)',
        )
      }
      // No usar auth/invalid-login-credentials: en UI se confunde con “mal password”.
      return NextResponse.json(
        { error: UNAUTHORIZED, code: 'api/token-id-no-verificado' },
        { status: 401 },
      )
    }

    try {
      await createSessionCookieFromIdToken(idToken)
    } catch (error: unknown) {
      const fb = error as { code?: string; message?: string }
      console.error(
        'POST /api/auth/session createSessionCookie',
        fb?.code ?? 'sin-codigo',
        fb?.message ?? error,
      )
      return NextResponse.json({ error: UNAUTHORIZED, code: 'api/sesion-servidor' }, { status: 401 })
    }

    try {
      await clearLoginFailures(email, ip)
    } catch (err) {
      // No bloquear login si Firestore falla al borrar el doc de intentos (p. ej. API no habilitada).
      console.error('POST /api/auth/session clearLoginFailures (no crítico)', err)
    }

    return NextResponse.json({ exito: true })
  } catch (error) {
    console.error('POST /api/auth/session', error)
    return NextResponse.json({ error: UNAUTHORIZED, code: 'api/sesion-servidor' }, { status: 401 })
  }
}

export async function DELETE() {
  try {
    await closeServerSession()
    return NextResponse.json({ exito: true })
  } catch (error) {
    console.error('DELETE /api/auth/session', error)
    return NextResponse.json({ error: UNAUTHORIZED }, { status: 401 })
  }
}
