import 'server-only'
// Firebase Admin (Auth + Firestore) singleton and safe server helpers.

import { createPrivateKey } from 'node:crypto'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getServerFirebaseEnv } from '@/lib/firebase/config'
import {
  firestoreReadMeterEnabled,
  wrapFirestoreForReadMeter,
} from '@/lib/firebase/firestoreReadMeter'

if (typeof window !== 'undefined') {
  throw new Error('adminFirebase must not run in the browser')
}

let adminApp: App | null = null
let firestoreRaw: Firestore | null = null
let firestoreResolved: Firestore | null = null

/**
 * Clave PEM desde .env / Vercel. Si llega mal (saltos, comillas, BOM), OpenSSL devuelve
 * error:1E08010C:DECODER routines::unsupported al pedir el token OAuth2.
 */
function normalizarClavePrivadaFirebase(raw: string): string {
  let s = raw.trim().replace(/^\uFEFF/, '')
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1)
  }
  s = s.replace(/\\n/g, '\n')
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
  return s
}

/** Comprueba que el PEM sea PKCS#8 válido antes de cert(); evita fallos opacos en createSessionCookie. */
function assertPemClaveServicioFirebase(pem: string): void {
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'FIREBASE_CLAVE_PRIVADA debe ser la private_key del JSON (-----BEGIN PRIVATE KEY-----).',
    )
  }
  try {
    createPrivateKey({ key: pem, format: 'pem' })
  } catch (cause) {
    throw new Error(
      'FIREBASE_CLAVE_PRIVADA no decodifica como PEM. En Vercel pega el valor como en el .json (private_key con \\n), sin cortar líneas ni comillas dentro del PEM.',
      { cause },
    )
  }
}

function getOrCreateAdminApp(): App {
  if (adminApp) {
    return adminApp
  }
  const env = getServerFirebaseEnv()
  const isEmulator = env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR

  if (getApps().length === 0) {
    if (isEmulator) {
      // En modo emulador no necesitamos la clave privada real de Google.
      adminApp = initializeApp({
        projectId: env.FIREBASE_ID_PROYECTO,
      })
    } else {
      // El Admin SDK usa FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST si existen en
      // process.env. Si quedan definidas en Vercel por error, verifyIdToken apunta al emulador
      // local y falla con tokens reales. Solo en modo emulador explícito las conservamos.
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST
      delete process.env.FIRESTORE_EMULATOR_HOST

      const privateKey = normalizarClavePrivadaFirebase(env.FIREBASE_CLAVE_PRIVADA)
      assertPemClaveServicioFirebase(privateKey)
      adminApp = initializeApp({
        credential: cert({
          projectId: env.FIREBASE_ID_PROYECTO,
          clientEmail: env.FIREBASE_CORREO_CLIENTE,
          privateKey,
        }),
      })
    }
  } else {
    adminApp = getApps()[0]!
  }
  return adminApp
}

export function getAdminAuth(): Auth {
  return getAuth(getOrCreateAdminApp())
}

export function getAdminFirestore(): Firestore {
  if (!firestoreRaw) {
    firestoreRaw = getFirestore(getOrCreateAdminApp())
  }
  if (firestoreReadMeterEnabled()) {
    if (!firestoreResolved) {
      firestoreResolved = wrapFirestoreForReadMeter(firestoreRaw)
      console.log(
        '[Firestore reads] Medidor activo (FIRESTORE_READ_METER). Tras cada lectura verás el TOTAL acumulado de la sesión en la línea siguiente.',
      )
    }
    return firestoreResolved
  }
  firestoreResolved = null
  return firestoreRaw
}

/** Get one document by id, or null if missing or on error (errors are logged, not thrown). */
export async function getDocumentById(
  collectionName: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const doc = await getAdminFirestore().collection(collectionName).doc(id).get()
    if (!doc.exists) {
      return null
    }
    return doc.data() as Record<string, unknown>
  } catch (error) {
    console.error('getDocumentById', collectionName, id, error)
    return null
  }
}

/** Upsert document; returns false on failure (logged). */
export async function saveDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    await getAdminFirestore().collection(collectionName).doc(id).set(data, { merge: true })
    return true
  } catch (error) {
    console.error('saveDocument', collectionName, id, error)
    return false
  }
}

/** Query documents where field == value; returns [] on error. */
export async function findDocumentsByField(
  collectionName: string,
  field: string,
  value: string,
): Promise<Record<string, unknown>[]> {
  try {
    const snapshot = await getAdminFirestore()
      .collection(collectionName)
      .where(field, '==', value)
      .get()
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
  } catch (error) {
    console.error('findDocumentsByField', collectionName, field, error)
    return []
  }
}
