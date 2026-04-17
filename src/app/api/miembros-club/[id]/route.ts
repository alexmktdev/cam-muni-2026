// PATCH / DELETE miembro (sesión + gestión).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { COLECCIONES } from '@/constants'
import { assertPuedeGestionar, assertSesionValida } from '@/lib/api/assertSessionGestion'
import { getAdminFirestore } from '@/lib/firebase/adminFirebase'
import { esRutChilenoValido } from '@/lib/validation/chileRut'
import { invalidarCachesTrasMutacionMiembrosClub } from '@/lib/cache/trasMutacionMiembrosClub'
import {
  actualizarMiembroClub,
  eliminarMiembroClub,
  mapMiembroDocToCliente,
} from '@/services/miembro-club.service'

const idSchema = z.string().trim().min(1).max(128)

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional().nullable()

const patchBodySchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(120),
  rut: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .refine((s) => esRutChilenoValido(s), { message: 'RUT inválido (dígito verificador no coincide)' }),
  fechaNacimiento: fechaSchema,
  telefono: z.string().trim().max(30).optional().nullable(),
  sector: z.string().trim().max(150).optional().nullable(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  const { id: rawId } = await context.params
  const idParsed = idSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const json = (await request.json().catch(() => null)) as unknown
  const body = patchBodySchema.safeParse(json)
  if (!body.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const res = await actualizarMiembroClub(idParsed.data, body.data)
  if (!res.ok) {
    if (res.codigo === 'no_encontrado') {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
    if (res.codigo === 'duplicado') {
      return NextResponse.json({ error: 'Ya existe otro miembro con ese RUT en el club' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }

  const doc = await getAdminFirestore().collection(COLECCIONES.miembrosClub).doc(idParsed.data).get()
  const data = doc.data() as Record<string, unknown> | undefined
  const miembro = data ? mapMiembroDocToCliente(doc.id, data) : null
  invalidarCachesTrasMutacionMiembrosClub()
  return NextResponse.json({ miembro })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  const { id: rawId } = await context.params
  const idParsed = idSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const ok = await eliminarMiembroClub(idParsed.data)
  if (!ok) {
    return NextResponse.json({ error: 'No encontrado o no se pudo eliminar' }, { status: 404 })
  }

  invalidarCachesTrasMutacionMiembrosClub()
  return NextResponse.json({ exito: true })
}
