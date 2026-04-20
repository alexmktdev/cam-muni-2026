// Reads and validates Firebase-related environment variables with Zod.

import { z } from 'zod'

const clientSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  /** Recomendado: copiar del snippet de Firebase Console (evita fallos raros de Auth). */
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_USE_FIREBASE_EMULATOR: z.string().optional().transform(v => v === 'true'),
})

const adminSchema = z.object({
  FIREBASE_ID_PROYECTO: z.string().min(1),
  FIREBASE_CORREO_CLIENTE: z.string().min(1),
  FIREBASE_CLAVE_PRIVADA: z.string().min(1),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
})

function throwIfEnvInvalid(result: z.SafeParseError<unknown>): never {
  const issues = result.error.issues
  const lines = issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
  const msg = lines.join('; ')
  // Nunca lanzar solo el mensaje genérico "Required" (Zod): sin nombre de campo no se depura en Vercel.
  console.error('[Firebase env] Validación fallida:', msg)
  throw new Error(`Variables Firebase inválidas o faltantes: ${msg}`)
}

/**
 * Public Firebase env vars; safe on client or server.
 * Next only inlines NEXT_PUBLIC_* when each key is read explicitly (not via full process.env).
 */
function optEnv(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function buildClientEnvPayload() {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: optEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optEnv(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR,
  }
}

export function getClientFirebaseEnv() {
  const result = clientSchema.safeParse(buildClientEnvPayload())
  if (!result.success) {
    throwIfEnvInvalid(result)
  }
  return result.data
}

/** Full env (client + Admin); server-only consumers. */
export function getServerFirebaseEnv() {
  const merged = clientSchema.merge(adminSchema).refine(
    (d) => d.FIREBASE_ID_PROYECTO === d.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    {
      message:
        'FIREBASE_ID_PROYECTO debe coincidir con NEXT_PUBLIC_FIREBASE_PROJECT_ID (Auth Admin y app web en el mismo proyecto)',
      path: ['FIREBASE_ID_PROYECTO'],
    },
  )
  const result = merged.safeParse({
    ...buildClientEnvPayload(),
    FIREBASE_ID_PROYECTO: process.env.FIREBASE_ID_PROYECTO,
    FIREBASE_CORREO_CLIENTE: process.env.FIREBASE_CORREO_CLIENTE,
    FIREBASE_CLAVE_PRIVADA: process.env.FIREBASE_CLAVE_PRIVADA,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  })
  if (!result.success) {
    throwIfEnvInvalid(result)
  }
  return result.data
}
