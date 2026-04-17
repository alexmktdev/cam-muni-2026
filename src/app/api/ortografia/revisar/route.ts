// POST: revisar ortografía vía LanguageTool (sesión válida).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSesionValida } from '@/lib/api/assertSessionGestion'
import { verificarOrtografia } from '@/lib/ortografia/languageToolCheck'

const bodySchema = z.object({
  texto: z.string().trim().min(1).max(500),
})

export async function POST(request: Request) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }

  const json = (await request.json().catch(() => null)) as unknown
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Texto inválido' }, { status: 400 })
  }

  const sugerencias = await verificarOrtografia(parsed.data.texto)
  return NextResponse.json({ sugerencias })
}
