// GET: perfil para barra lateral (sesión). Payload pequeño para no inflar el RSC del layout.

import { NextResponse } from 'next/server'
import { assertSesionValida } from '@/lib/api/assertSessionGestion'
import { getSidebarProfileForSession } from '@/lib/auth/sidebarProfile'

export async function GET() {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }

  const perfil = await getSidebarProfileForSession(auth.uid, auth.email)
  return NextResponse.json({ perfil })
}
