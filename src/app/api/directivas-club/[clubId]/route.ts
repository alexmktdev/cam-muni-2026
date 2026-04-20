// GET: obtener directiva (sesión). PUT: guardar (sesión + gestión). DELETE: borrar doc (gestión).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertPuedeGestionar, assertSesionValida } from '@/lib/api/assertSessionGestion'
import {
  eliminarDirectivaClub,
  guardarDirectivaClub,
  obtenerDirectivaClub,
} from '@/services/directiva-club.service'

const clubIdSchema = z.string().trim().min(1).max(128)

const CARGOS_VALIDOS = [
  'presidente',
  'vicepresidente',
  'secretario',
  'tesorero',
  'director',
  'otro',
] as const

const miembroSchema = z.object({
  id: z.string().max(64).default(''),
  miembroClubId: z.string().trim().min(1).max(128),
  cargo: z.enum(CARGOS_VALIDOS),
  nombreCompleto: z.string().trim().min(1).max(200),
  telefono: z.string().trim().max(30).default(''),
})

const putBodySchema = z.object({
  miembros: z.array(miembroSchema).max(20),
  lugarReunion: z.string().trim().max(200).default(''),
  diaReunion: z.string().trim().max(100).default(''),
  horarioReunion: z.string().trim().max(100).default(''),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ clubId: string }> },
) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }

  const { clubId: rawId } = await context.params
  const parsed = clubIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Club inválido' }, { status: 400 })
  }

  const directiva = await obtenerDirectivaClub(parsed.data)
  return NextResponse.json({ directiva })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ clubId: string }> },
) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  const { clubId: rawId } = await context.params
  const idParsed = clubIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Club inválido' }, { status: 400 })
  }

  const json = (await request.json().catch(() => null)) as unknown
  const body = putBodySchema.safeParse(json)
  if (!body.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const res = await guardarDirectivaClub(idParsed.data, body.data)
  if (!res.ok) {
    if (res.codigo === 'miembro_no_registrado') {
      return NextResponse.json(
        {
          error:
            'Uno o más cargos no corresponden a un miembro registrado en este club. Registre primero a la persona como miembro del club.',
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'No se pudo guardar la directiva' }, { status: 500 })
  }

  const directiva = await obtenerDirectivaClub(idParsed.data)
  return NextResponse.json({ directiva })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ clubId: string }> },
) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  const { clubId: rawId } = await context.params
  const idParsed = clubIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Club inválido' }, { status: 400 })
  }

  const ok = await eliminarDirectivaClub(idParsed.data)
  if (!ok) {
    return NextResponse.json({ error: 'No se pudo eliminar la directiva' }, { status: 500 })
  }
  return NextResponse.json({ exito: true })
}
