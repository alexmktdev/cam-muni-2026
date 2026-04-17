// POST: normalizar nombres (Title Case) para un club completo.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertPuedeGestionar, assertSesionValida } from '@/lib/api/assertSessionGestion'
import { invalidarCachesTrasMutacionMiembrosClub } from '@/lib/cache/trasMutacionMiembrosClub'
import { normalizarNombresMasivoClub } from '@/services/miembro-club.service'

const bodySchema = z.object({
  clubId: z.string().trim().min(1).max(128),
  aplicar: z.boolean().default(false),
})

export async function POST(request: Request) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  const json = (await request.json().catch(() => null)) as unknown
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const resultado = await normalizarNombresMasivoClub(parsed.data.clubId, parsed.data.aplicar)

  if (parsed.data.aplicar && resultado.modificados > 0) {
    invalidarCachesTrasMutacionMiembrosClub()
  }

  return NextResponse.json(resultado)
}
