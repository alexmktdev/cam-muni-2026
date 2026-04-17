import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { assertPuedeGestionar, assertSesionValida } from '@/lib/api/assertSessionGestion'
import { TAG_CACHE_MIEMBROS_CONSOLIDADO } from '@/lib/cache/miembrosConsolidado'
import { obtenerTodosLosMiembrosConsolidados } from '@/services/busqueda-miembros.service'

const consolidadoCacheado = unstable_cache(
  () => obtenerTodosLosMiembrosConsolidados(),
  ['admin-miembros-consolidado-v1'],
  {
    revalidate: 7200,
    tags: [TAG_CACHE_MIEMBROS_CONSOLIDADO],
  },
)

export async function GET() {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }
  const forbidden = await assertPuedeGestionar(auth)
  if (forbidden) {
    return forbidden
  }

  try {
    const data = await consolidadoCacheado()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error en API miembros/consolidado:', error)
    return NextResponse.json({ error: 'Fallo al obtener la base consolidada de miembros' }, { status: 500 })
  }
}
