// GET: miembros por clubId (sesión). POST: crear miembro (sesión + gestión).

import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { COLECCIONES } from '@/constants'
import { assertPuedeGestionar, assertSesionValida } from '@/lib/api/assertSessionGestion'
import { TAG_CACHE_MIEMBROS_CLUB_API } from '@/lib/cache/miembrosClubApi'
import { getAdminFirestore } from '@/lib/firebase/adminFirebase'
import { esRutChilenoValido } from '@/lib/validation/chileRut'
import { invalidarCachesTrasMutacionMiembrosClub } from '@/lib/cache/trasMutacionMiembrosClub'
import {
  aplicarFiltrosMiembros,
  crearMiembroClub,
  listMiembrosPorClubPage,
  mapMiembroDocToCliente,
  searchMiembrosPorClub,
  totalMiembrosClubParaListado,
  type FiltrosMiembros,
} from '@/services/miembro-club.service'

const clubIdQuery = z.string().trim().min(1).max(128)

const limitQuery = z.coerce.number().int().min(1).max(200)
const pageQuery = z.coerce.number().int().min(1).max(5000)

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional().nullable()

const postBodySchema = z.object({
  clubId: z.string().trim().min(1).max(128),
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

export async function GET(request: Request) {
  const auth = await assertSesionValida()
  if (auth instanceof NextResponse) {
    return auth
  }

  const { searchParams } = new URL(request.url)
  const rawClub = searchParams.get('clubId')
  const parsed = clubIdQuery.safeParse(rawClub ?? '')
  if (!parsed.success) {
    return NextResponse.json({ error: 'Indique un club' }, { status: 400 })
  }

  const filtros: FiltrosMiembros = {}
  const rawEdadMin = searchParams.get('edadMin')
  const rawEdadMax = searchParams.get('edadMax')
  const rawSector = searchParams.get('sector')
  const rawFechaDesde = searchParams.get('fechaDesde')
  const rawFechaHasta = searchParams.get('fechaHasta')

  if (rawEdadMin) {
    const n = parseInt(rawEdadMin, 10)
    if (!isNaN(n)) filtros.edadMin = n
  }
  if (rawEdadMax) {
    const n = parseInt(rawEdadMax, 10)
    if (!isNaN(n)) filtros.edadMax = n
  }
  if (rawSector) filtros.sector = rawSector.trim()
  if (rawFechaDesde) filtros.fechaDesde = rawFechaDesde.trim()
  if (rawFechaHasta) filtros.fechaHasta = rawFechaHasta.trim()

  const tieneFiltros = Object.values(filtros).some((v) => v != null)

  const queryParams = searchParams.get('q')
  const qNorm = (queryParams ?? '').trim()

  // Si hay búsqueda por texto O filtros avanzados activos, usamos la estrategia de carga amplia (hasta 500)
  if (qNorm !== '' || tieneFiltros) {
    const clubId = parsed.data
    const payload = await unstable_cache(
      async () => {
        const miembros = await searchMiembrosPorClub(clubId, qNorm, filtros)
        return {
          miembros,
          total: miembros.length,
          modo: 'busqueda' as const,
        }
      },
      ['api-miembros-club', clubId, 'q', qNorm.slice(0, 160), JSON.stringify(filtros)],
      { revalidate: 600, tags: [TAG_CACHE_MIEMBROS_CLUB_API] },
    )()
    return NextResponse.json(payload)
  }

  const limParsed = limitQuery.safeParse(searchParams.get('limit') ?? '10')
  if (!limParsed.success) {
    return NextResponse.json({ error: 'Parámetro limit inválido (1–200)' }, { status: 400 })
  }
  const pageParsed = pageQuery.safeParse(searchParams.get('page') ?? '1')
  if (!pageParsed.success) {
    return NextResponse.json({ error: 'Parámetro page inválido' }, { status: 400 })
  }

  const clubId = parsed.data
  const pageNum = pageParsed.data
  const lim = limParsed.data
  const cursorParam = searchParams.get('cursor') ?? undefined

  const payload = await unstable_cache(
    async () => {
      const [total, result] = await Promise.all([
        totalMiembrosClubParaListado(clubId),
        listMiembrosPorClubPage(clubId, pageNum, lim, cursorParam),
      ])
      const miembrosFiltrados = tieneFiltros
        ? aplicarFiltrosMiembros(result.miembros, filtros)
        : result.miembros
      return {
        miembros: miembrosFiltrados,
        page: pageNum,
        pageSize: lim,
        total: tieneFiltros ? miembrosFiltrados.length : total,
        nextCursor: result.lastDocId,
        modo: 'pagina' as const,
      }
    },
    ['api-miembros-club', clubId, 'p', String(pageNum), String(lim), cursorParam ?? '', JSON.stringify(filtros)],
    { revalidate: 600, tags: [TAG_CACHE_MIEMBROS_CLUB_API] },
  )()

  return NextResponse.json(payload)
}

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
  const parsed = postBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const res = await crearMiembroClub(parsed.data)
  if (!res.ok) {
    if (res.codigo === 'club_invalido') {
      return NextResponse.json({ error: 'El club no existe' }, { status: 400 })
    }
    if (res.codigo === 'duplicado') {
      return NextResponse.json({ error: 'Ya existe un miembro con ese RUT en el club' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo crear el miembro' }, { status: 500 })
  }

  const doc = await getAdminFirestore().collection(COLECCIONES.miembrosClub).doc(res.id).get()
  const data = doc.data() as Record<string, unknown> | undefined
  const miembro = data ? mapMiembroDocToCliente(doc.id, data) : null
  invalidarCachesTrasMutacionMiembrosClub()
  return NextResponse.json({ miembro }, { status: 201 })
}
