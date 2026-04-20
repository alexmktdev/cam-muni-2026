import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { COLECCIONES } from '@/constants'
import { getAdminFirestore } from '@/lib/firebase/adminFirebase'
import { normalizarNombrePersona } from '@/lib/normalizacion/normalizarNombre'
import type {
  CargoDirectiva,
  DirectivaClubCliente,
  MiembroDirectivaCliente,
} from '@/types/directiva-club.types'

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw.trim() : fallback
}

function parseMiembrosDirectiva(raw: unknown): MiembroDirectivaCliente[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item, i) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const d = item as Record<string, unknown>
      const nombreCompleto = str(d.nombreCompleto)
      const cargo = str(d.cargo) as CargoDirectiva
      if (!nombreCompleto || !cargo) {
        return null
      }
      const mid = str(d.miembroClubId)
      return {
        id: str(d.id) || `dir-${i}`,
        cargo,
        nombreCompleto,
        telefono: str(d.telefono),
        miembroClubId: mid || null,
      }
    })
    .filter((m): m is MiembroDirectivaCliente => m !== null)
}

export async function obtenerDirectivaClub(
  clubId: string,
): Promise<DirectivaClubCliente | null> {
  try {
    const doc = await getAdminFirestore()
      .collection(COLECCIONES.directivasClub)
      .doc(clubId)
      .get()
    if (!doc.exists) {
      return null
    }
    const data = doc.data() as Record<string, unknown>
    const clubIdGuardado = str(data.clubId) || clubId
    return {
      clubId: clubIdGuardado,
      miembros: parseMiembrosDirectiva(data.miembros),
      lugarReunion: str(data.lugarReunion),
      diaReunion: str(data.diaReunion),
      horarioReunion: str(data.horarioReunion),
    }
  } catch (error) {
    console.error('obtenerDirectivaClub', error)
    return null
  }
}

/** Borra el documento de directiva del club (si existía). */
export async function eliminarDirectivaClub(clubId: string): Promise<boolean> {
  try {
    await getAdminFirestore().collection(COLECCIONES.directivasClub).doc(clubId).delete()
    return true
  } catch (error) {
    console.error('eliminarDirectivaClub', error)
    return false
  }
}

export type GuardarDirectivaInput = {
  miembros: {
    id: string
    miembroClubId: string
    cargo: CargoDirectiva
    nombreCompleto: string
    telefono: string
  }[]
  lugarReunion: string
  diaReunion: string
  horarioReunion: string
}

export async function guardarDirectivaClub(
  clubId: string,
  input: GuardarDirectivaInput,
): Promise<
  { ok: true } | { ok: false; codigo: 'miembro_no_registrado' | 'error' }
> {
  try {
    const db = getAdminFirestore()
    if (input.miembros.length > 0) {
      const refs = input.miembros.map((m) =>
        db.collection(COLECCIONES.miembrosClub).doc(m.miembroClubId.trim()),
      )
      const docs = await db.getAll(...refs)
      for (const doc of docs) {
        if (!doc.exists) {
          return { ok: false, codigo: 'miembro_no_registrado' }
        }
        const data = doc.data() as Record<string, unknown> | undefined
        if (data?.clubId !== clubId) {
          return { ok: false, codigo: 'miembro_no_registrado' }
        }
      }
    }

    const miembros = input.miembros.map((m, i) => ({
      id: m.id || `dir-${i}`,
      miembroClubId: m.miembroClubId.trim(),
      cargo: m.cargo,
      nombreCompleto: normalizarNombrePersona(m.nombreCompleto),
      telefono: m.telefono.trim(),
    }))

    await db
      .collection(COLECCIONES.directivasClub)
      .doc(clubId)
      .set(
        {
          /** Mismo valor que el id del documento; útil en exportes y reglas sin depender solo del path. */
          clubId,
          miembros,
          lugarReunion: input.lugarReunion.trim(),
          diaReunion: input.diaReunion.trim(),
          horarioReunion: input.horarioReunion.trim(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: false },
      )
    return { ok: true }
  } catch (error) {
    console.error('guardarDirectivaClub', error)
    return { ok: false, codigo: 'error' }
  }
}
