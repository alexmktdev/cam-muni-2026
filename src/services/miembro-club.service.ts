import 'server-only'
// CRUD miembros por club + sincronía del contador `miembros` en el documento del club.

import { FieldPath, FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { COLECCIONES } from '@/constants'
import { parsearCsvTexto } from '@/lib/csv/parseCsvLineas'
import { getAdminFirestore, getDocumentById } from '@/lib/firebase/adminFirebase'
import { partirNombreCompletoCsv } from '@/lib/miembros-club/partirNombreCompleto'
import { calcularEdad } from '@/lib/fecha/calcularEdad'
import { normalizarNombrePersona } from '@/lib/normalizacion/normalizarNombre'
import {
  esRutChilenoFormatoValido,
  formatearRutMostrar,
  normalizarRutChile,
} from '@/lib/validation/chileRut'
import { listClubesFromFirestore } from '@/services/club.service'
import {
  panelAjusteTrasReconteoClub,
  panelDeltaTotalMiembros,
  panelSincronizarTrasVaciarTodos,
  reconstruirYGuardarResumenPanel,
} from '@/services/panel-resumen.service'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

function miembrosEnDocClub(data: Record<string, unknown>): number {
  for (const raw of [
    data.miembros,
    data.memberCount,
    data.totalMiembros,
    data.membresias,
  ]) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, Math.floor(raw))
    }
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
      return Math.max(0, parseInt(raw.trim(), 10))
    }
  }
  return 0
}

function clubDataActivo(data: Record<string, unknown>): boolean {
  const a = data.activo ?? data.active
  if (typeof a === 'boolean') {
    return a
  }
  if (a === 'false' || a === 0) {
    return false
  }
  return true
}

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw.trim() : fallback
}

export function mapMiembroDocToCliente(
  id: string,
  data: Record<string, unknown>,
): MiembroClubCliente | null {
  const clubId = str(data.clubId)
  const nombre = str(data.nombre) || str(data.nombres)
  const apellidos = str(data.apellidos) || str(data.apellido)
  const rut = normalizarRutChile(str(data.rut))
  if (!clubId || !nombre || !apellidos || !rut) {
    return null
  }
  const fechaNacimiento = str(data.fechaNacimiento) || null
  return {
    id,
    clubId,
    nombre,
    apellidos,
    rut,
    rutFormateado: formatearRutMostrar(rut),
    fechaNacimiento,
    edad: calcularEdad(fechaNacimiento),
    telefono: str(data.telefono) || null,
    sector: str(data.sector) || null,
  }
}

export async function clubDocumentoExiste(clubId: string): Promise<boolean> {
  try {
    const d = await getAdminFirestore().collection(COLECCIONES.clubes).doc(clubId).get()
    return d.exists
  } catch {
    return false
  }
}

export async function contarMiembrosPorClub(clubId: string): Promise<number> {
  try {
    const snap = await getAdminFirestore()
      .collection(COLECCIONES.miembrosClub)
      .where('clubId', '==', clubId)
      .count()
      .get()
    return snap.data().count
  } catch (error) {
    console.error('contarMiembrosPorClub', error)
    return 0
  }
}

/**
 * Total para paginación en UI: **1 lectura** del documento del club (campo `miembros`).
 * Más barato que `count()` sobre `miembros_club` en clubes grandes. Si el contador está desfasado,
 * use «Actualizar contador del club».
 */
export async function totalMiembrosClubParaListado(clubId: string): Promise<number> {
  const raw = await getDocumentById(COLECCIONES.clubes, clubId)
  if (!raw) {
    return 0
  }
  return miembrosEnDocClub(raw)
}

export async function sincronizarContadorMiembrosEnClub(
  clubId: string,
  opts?: { actualizarPanelGlobal?: boolean },
): Promise<{ conteo: number }> {
  const actualizarPanel = opts?.actualizarPanelGlobal !== false
  try {
    const [prev, n] = await Promise.all([
      getDocumentById(COLECCIONES.clubes, clubId),
      contarMiembrosPorClub(clubId),
    ])
    const oldM = prev ? miembrosEnDocClub(prev) : 0
    await getAdminFirestore()
      .collection(COLECCIONES.clubes)
      .doc(clubId)
      .set({ miembros: n }, { merge: true })
    if (actualizarPanel) {
      await panelAjusteTrasReconteoClub(oldM, n)
    }
    return { conteo: n }
  } catch (error) {
    console.error('sincronizarContadorMiembrosEnClub', error)
    return { conteo: 0 }
  }
}

/** Reescribe el campo `miembros` de cada club con el conteo real en `miembros_club`. */
export async function sincronizarContadoresMiembrosTodosLosClubes(): Promise<{
  clubesProcesados: number
}> {
  const clubes = await listClubesFromFirestore()
  for (const c of clubes) {
    await sincronizarContadorMiembrosEnClub(c.id, { actualizarPanelGlobal: false })
  }
  await reconstruirYGuardarResumenPanel()
  return { clubesProcesados: clubes.length }
}

/** Ajusta el campo `miembros` del club sin re-leer toda la colección (menos lecturas que recontar). */
export async function incrementarContadorMiembrosEnClub(clubId: string, delta: number): Promise<void> {
  if (delta === 0) {
    return
  }
  try {
    await getAdminFirestore()
      .collection(COLECCIONES.clubes)
      .doc(clubId)
      .update({ miembros: FieldValue.increment(delta) })
    await panelDeltaTotalMiembros(delta)
  } catch (error) {
    console.error('incrementarContadorMiembrosEnClub', error)
  }
}

const MIEMBROS_POR_PAGINA_MAX = 200

/**
 * Página de miembros de un club con paginación por cursor (startAfter).
 * Si se provee `startAfterDocId`, se posiciona después de ese documento (evita el costo de offset).
 * Dentro de la página se ordena alfabéticamente para la tabla.
 */
export async function listMiembrosPorClubPage(
  clubId: string,
  _page: number,
  pageSize: number,
  startAfterDocId?: string,
): Promise<{ miembros: MiembroClubCliente[]; lastDocId: string | null }> {
  const lim = Math.min(Math.max(1, pageSize), MIEMBROS_POR_PAGINA_MAX)
  try {
    const col = getAdminFirestore().collection(COLECCIONES.miembrosClub)
    let q = col
      .where('clubId', '==', clubId)
      .orderBy(FieldPath.documentId())

    if (startAfterDocId) {
      q = q.startAfter(startAfterDocId)
    }

    const snap = await q.limit(lim).get()

    const out: MiembroClubCliente[] = []
    for (const doc of snap.docs) {
      const m = mapMiembroDocToCliente(doc.id, doc.data() as Record<string, unknown>)
      if (m) {
        out.push(m)
      }
    }

    const lastDocId = snap.docs.length > 0
      ? snap.docs[snap.docs.length - 1]!.id
      : null

    out.sort((a, b) => {
      return `${a.apellidos} ${a.nombre}`.localeCompare(
        `${b.apellidos} ${b.nombre}`,
        'es',
        { sensitivity: 'base' },
      )
    })
    return { miembros: out, lastDocId }
  } catch (error) {
    console.error('listMiembrosPorClubPage', error)
    return { miembros: [], lastDocId: null }
  }
}

/**
 * Búsqueda optimizada por servidor. 
 * Trae un conjunto limitado de resultados para filtrar en el backend antes de enviar al cliente.
 */
export async function searchMiembrosPorClub(
  clubId: string,
  query: string,
): Promise<MiembroClubCliente[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  try {
    const col = getAdminFirestore().collection(COLECCIONES.miembrosClub)
    
    // Para ahorrar lecturas, traemos un máximo de 200 registros del club para filtrar en memoria del servidor.
    // En una implementación más avanzada se usaría un índice de búsqueda (Algolia/Elastic) o campos de búsqueda prefijados.
    const snap = await col
      .where('clubId', '==', clubId)
      .limit(200) 
      .get()

    const out: MiembroClubCliente[] = []
    for (const doc of snap.docs) {
      const m = mapMiembroDocToCliente(doc.id, doc.data() as Record<string, unknown>)
      if (m) {
        const blob = `${m.nombre} ${m.apellidos} ${m.rut} ${m.rutFormateado}`.toLowerCase()
        if (blob.includes(q)) {
          out.push(m)
        }
      }
    }

    return out.sort((a, b) =>
      `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es'),
    )
  } catch (error) {
    console.error('searchMiembrosPorClub', error)
    return []
  }
}

export type FiltrosMiembros = {
  edadMin?: number
  edadMax?: number
  sector?: string
  fechaDesde?: string
  fechaHasta?: string
}

export function aplicarFiltrosMiembros(
  miembros: MiembroClubCliente[],
  filtros: FiltrosMiembros,
): MiembroClubCliente[] {
  return miembros.filter((m) => {
    if (filtros.edadMin != null && (m.edad == null || m.edad < filtros.edadMin)) {
      return false
    }
    if (filtros.edadMax != null && (m.edad == null || m.edad > filtros.edadMax)) {
      return false
    }
    if (filtros.sector && m.sector && !m.sector.toLowerCase().includes(filtros.sector.toLowerCase())) {
      return false
    }
    if (filtros.sector && !m.sector) {
      return false
    }
    if (filtros.fechaDesde && (!m.fechaNacimiento || m.fechaNacimiento < filtros.fechaDesde)) {
      return false
    }
    if (filtros.fechaHasta && (!m.fechaNacimiento || m.fechaNacimiento > filtros.fechaHasta)) {
      return false
    }
    return true
  })
}

export async function existeMiembroRutEnClub(
  clubId: string,
  rutNormalizado: string,
): Promise<boolean> {
  try {
    const snap = await getAdminFirestore()
      .collection(COLECCIONES.miembrosClub)
      .where('clubId', '==', clubId)
      .where('rut', '==', rutNormalizado)
      .limit(1)
      .get()
    return !snap.empty
  } catch (error) {
    console.error('existeMiembroRutEnClub', error)
    return true
  }
}

/**
 * Carga todos los RUTs existentes de un club en un Set (1 query vs N queries individuales).
 * Útil para importaciones masivas donde se verifica deduplicación fila por fila.
 */
export async function cargarRutsDelClub(clubId: string): Promise<Set<string>> {
  const ruts = new Set<string>()
  try {
    const snap = await getAdminFirestore()
      .collection(COLECCIONES.miembrosClub)
      .where('clubId', '==', clubId)
      .select('rut')
      .get()
    for (const doc of snap.docs) {
      const r = doc.data().rut
      if (typeof r === 'string' && r.trim()) {
        ruts.add(r.trim())
      }
    }
  } catch (error) {
    console.error('cargarRutsDelClub', error)
  }
  return ruts
}

export type CrearMiembroClubInput = {
  clubId: string
  nombre: string
  apellidos: string
  rut: string
  fechaNacimiento?: string | null
  telefono?: string | null
  sector?: string | null
}

export async function crearMiembroClub(
  input: CrearMiembroClubInput,
): Promise<{ ok: true; id: string } | { ok: false; codigo: 'club_invalido' | 'duplicado' | 'error' }> {
  const okClub = await clubDocumentoExiste(input.clubId)
  if (!okClub) {
    return { ok: false, codigo: 'club_invalido' }
  }
  const rut = normalizarRutChile(input.rut)
  const dup = await existeMiembroRutEnClub(input.clubId, rut)
  if (dup) {
    return { ok: false, codigo: 'duplicado' }
  }
  try {
    const docData: Record<string, unknown> = {
      clubId: input.clubId,
      nombre: normalizarNombrePersona(input.nombre),
      apellidos: normalizarNombrePersona(input.apellidos),
      rut,
      createdAt: FieldValue.serverTimestamp(),
    }
    if (input.fechaNacimiento) {
      docData.fechaNacimiento = input.fechaNacimiento.trim()
    }
    if (input.telefono) {
      docData.telefono = input.telefono.trim()
    }
    if (input.sector) {
      docData.sector = input.sector.trim()
    }
    const ref = await getAdminFirestore().collection(COLECCIONES.miembrosClub).add(docData)
    await incrementarContadorMiembrosEnClub(input.clubId, 1)
    return { ok: true, id: ref.id }
  } catch (error) {
    console.error('crearMiembroClub', error)
    return { ok: false, codigo: 'error' }
  }
}

export type ActualizarMiembroClubInput = {
  nombre: string
  apellidos: string
  rut: string
  fechaNacimiento?: string | null
  telefono?: string | null
  sector?: string | null
}

export async function obtenerMiembroClubPorId(
  id: string,
): Promise<{ clubId: string; data: Record<string, unknown> } | null> {
  try {
    const d = await getAdminFirestore().collection(COLECCIONES.miembrosClub).doc(id).get()
    if (!d.exists) {
      return null
    }
    const data = d.data() as Record<string, unknown>
    const clubId = str(data.clubId)
    if (!clubId) {
      return null
    }
    return { clubId, data }
  } catch {
    return null
  }
}

export async function actualizarMiembroClub(
  id: string,
  input: ActualizarMiembroClubInput,
): Promise<
  { ok: true } | { ok: false; codigo: 'no_encontrado' | 'duplicado' | 'error' }
> {
  const row = await obtenerMiembroClubPorId(id)
  if (!row) {
    return { ok: false, codigo: 'no_encontrado' }
  }
  const rut = normalizarRutChile(input.rut)
  const rutActual = normalizarRutChile(str(row.data.rut))
  if (rut !== rutActual) {
    const dup = await existeMiembroRutEnClub(row.clubId, rut)
    if (dup) {
      return { ok: false, codigo: 'duplicado' }
    }
  }
  try {
    const updateData: Record<string, unknown> = {
      nombre: normalizarNombrePersona(input.nombre),
      apellidos: normalizarNombrePersona(input.apellidos),
      rut,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (input.fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = input.fechaNacimiento || null
    }
    if (input.telefono !== undefined) {
      updateData.telefono = input.telefono?.trim() || null
    }
    if (input.sector !== undefined) {
      updateData.sector = input.sector?.trim() || null
    }
    await getAdminFirestore()
      .collection(COLECCIONES.miembrosClub)
      .doc(id)
      .update(updateData)
    return { ok: true }
  } catch (error) {
    console.error('actualizarMiembroClub', error)
    return { ok: false, codigo: 'error' }
  }
}

export async function eliminarMiembroClub(id: string): Promise<boolean> {
  try {
    const row = await obtenerMiembroClubPorId(id)
    if (!row) {
      return false
    }
    const clubId = row.clubId
    await getAdminFirestore().collection(COLECCIONES.miembrosClub).doc(id).delete()
    await incrementarContadorMiembrosEnClub(clubId, -1)
    return true
  } catch (error) {
    console.error('eliminarMiembroClub', error)
    return false
  }
}

const MAX_LINEAS_CSV_MIEMBROS = 8000
const MAX_ERRORES_CSV_MIEMBROS = 120
const BATCH_CSV_WRITES = 450

function normalizarHeaderCsv(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** CSV de dos columnas: nombre completo + RUT. */
function indicesHeadersCsvMiembros(celdas: string[]): {
  nombreCompleto: number
  rut: number
} | null {
  const h = celdas.map((x) => normalizarHeaderCsv(x))
  if (h.some((x) => x === 'apellidos' || x === 'apellido')) {
    return null
  }
  let nombreCompleto = h.findIndex((x) => x === 'nombre completo')
  if (nombreCompleto < 0) {
    nombreCompleto = h.findIndex((x) => x.includes('nombre') && x.includes('completo'))
  }
  if (nombreCompleto < 0) {
    nombreCompleto = h.findIndex((x) => x === 'nombre' || x === 'nombres')
  }
  const rut = h.findIndex((x) => x === 'rut' || x === 'run')
  if (nombreCompleto < 0 || rut < 0 || nombreCompleto === rut) {
    return null
  }
  return { nombreCompleto, rut }
}

export type ResultadoImportCsvMiembrosClub = {
  agregados: number
  omitidosDuplicado: number
  filasConError: number
  errores: string[]
}

/**
 * CSV de dos columnas: nombre completo (o «Nombre completo») y rut (o RUN).
 * La primera palabra del nombre → `nombre`, el resto → `apellidos`. Sin columna #.
 */
export async function importarCsvMiembrosClub(
  clubId: string,
  textoCsv: string,
): Promise<ResultadoImportCsvMiembrosClub> {
  const errores: string[] = []
  if (!(await clubDocumentoExiste(clubId))) {
    return {
      agregados: 0,
      omitidosDuplicado: 0,
      filasConError: 0,
      errores: ['El club no existe.'],
    }
  }

  const { filas } = parsearCsvTexto(textoCsv, MAX_LINEAS_CSV_MIEMBROS)
  if (filas.length < 2) {
    return {
      agregados: 0,
      omitidosDuplicado: 0,
      filasConError: 0,
      errores: ['El archivo debe incluir la primera fila de encabezados y al menos una fila de datos.'],
    }
  }

  const idx = indicesHeadersCsvMiembros(filas[0]!)
  if (!idx) {
    return {
      agregados: 0,
      omitidosDuplicado: 0,
      filasConError: 0,
      errores: [
        'Encabezados requeridos: «Nombre completo» (o nombre) y «RUT» (o RUN). Solo dos columnas de datos.',
      ],
    }
  }

  const db = getAdminFirestore()
  const col = db.collection(COLECCIONES.miembrosClub)
  const rutsEnArchivo = new Set<string>()
  const rutsExistentes = await cargarRutsDelClub(clubId)

  let agregados = 0
  let omitidosDuplicado = 0
  let filasConError = 0
  let batch = db.batch()
  let opsEnBatch = 0

  async function flushBatch() {
    if (opsEnBatch > 0) {
      await batch.commit()
      batch = db.batch()
      opsEnBatch = 0
    }
  }

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]!
    const linea = i + 1
    const nombreFull = (fila[idx.nombreCompleto] ?? '').trim()
    const rutRaw = fila[idx.rut] ?? ''
    const { nombre, apellidos } = partirNombreCompletoCsv(nombreFull)

    if (!nombreFull && !rutRaw.trim() && fila.every((c) => !String(c).trim())) {
      continue
    }

    const rut = normalizarRutChile(rutRaw)
    if (!nombre || !apellidos || !rut) {
      filasConError++
      if (errores.length < MAX_ERRORES_CSV_MIEMBROS) {
        errores.push(`Fila ${linea}: nombre completo o RUT vacío o inválido.`)
      }
      continue
    }
    if (!esRutChilenoFormatoValido(rutRaw)) {
      filasConError++
      if (errores.length < MAX_ERRORES_CSV_MIEMBROS) {
        errores.push(
          `Fila ${linea}: RUT con formato inválido (${rutRaw.trim()}); use 7 u 8 dígitos y DV (0-9 o K).`,
        )
      }
      continue
    }
    if (rutsEnArchivo.has(rut)) {
      filasConError++
      if (errores.length < MAX_ERRORES_CSV_MIEMBROS) {
        errores.push(`Fila ${linea}: RUT duplicado en el archivo.`)
      }
      continue
    }
    rutsEnArchivo.add(rut)
    if (rutsExistentes.has(rut)) {
      omitidosDuplicado++
      continue
    }

    const ref = col.doc()
    batch.set(ref, {
      clubId,
      nombre,
      apellidos,
      rut,
      createdAt: FieldValue.serverTimestamp(),
    })
    opsEnBatch++
    agregados++

    if (opsEnBatch >= BATCH_CSV_WRITES) {
      await flushBatch()
    }
  }

  await flushBatch()
  if (agregados > 0) {
    await incrementarContadorMiembrosEnClub(clubId, agregados)
  }

  return {
    agregados,
    omitidosDuplicado,
    filasConError,
    errores: errores.slice(0, MAX_ERRORES_CSV_MIEMBROS),
  }
}

const BATCH_FIRESTORE_OP = 500

/** Borra todos los `miembros_club` del club, pone `miembros: 0` en el documento del club y ajusta el panel. */
export async function vaciarMiembrosDelClubEnFirestore(
  clubId: string,
): Promise<
  { ok: true; documentosEliminados: number } | { ok: false; codigo: 'club_invalido' | 'error' }
> {
  const db = getAdminFirestore()
  const col = db.collection(COLECCIONES.miembrosClub)
  const prevClub = await getDocumentById(COLECCIONES.clubes, clubId)
  if (!prevClub) {
    return { ok: false, codigo: 'club_invalido' }
  }
  const oldMStored = miembrosEnDocClub(prevClub)
  let documentosEliminados = 0
  try {
    for (;;) {
      const snap = await col.where('clubId', '==', clubId).limit(BATCH_FIRESTORE_OP).get()
      if (snap.empty) {
        break
      }
      const batch = db.batch()
      for (const d of snap.docs) {
        batch.delete(d.ref)
      }
      await batch.commit()
      documentosEliminados += snap.docs.length
      if (snap.size < BATCH_FIRESTORE_OP) {
        break
      }
    }
    await db
      .collection(COLECCIONES.clubes)
      .doc(clubId)
      .set({ miembros: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

    await panelAjusteTrasReconteoClub(oldMStored, 0)
    if (documentosEliminados > oldMStored) {
      await panelDeltaTotalMiembros(oldMStored - documentosEliminados)
    }

    return { ok: true, documentosEliminados }
  } catch (error) {
    console.error('vaciarMiembrosDelClubEnFirestore', error)
    return { ok: false, codigo: 'error' }
  }
}

export type ResultadoVaciarTodosMiembros =
  | { ok: true; documentosEliminados: number; clubesConContadorReseteado: number }
  | { ok: false; codigo: 'error' }

/** Borra todos los documentos de `miembros_club` y deja `miembros: 0` en cada club (los clubes no se eliminan). */
export async function vaciarTodosLosMiembrosClubEnFirestore(): Promise<ResultadoVaciarTodosMiembros> {
  const db = getAdminFirestore()
  const col = db.collection(COLECCIONES.miembrosClub)
  let documentosEliminados = 0
  try {
    let last: QueryDocumentSnapshot | null = null
    for (;;) {
      let q = col.orderBy(FieldPath.documentId()).limit(BATCH_FIRESTORE_OP)
      if (last) {
        q = q.startAfter(last)
      }
      const snap = await q.get()
      if (snap.empty) {
        break
      }
      const batch = db.batch()
      for (const d of snap.docs) {
        batch.delete(d.ref)
      }
      await batch.commit()
      documentosEliminados += snap.docs.length
      last = snap.docs[snap.docs.length - 1]!
      if (snap.size < BATCH_FIRESTORE_OP) {
        break
      }
    }

    const clubSnap = await db.collection(COLECCIONES.clubes).get()
    let clubesActivosEnPanel = 0
    for (const d of clubSnap.docs) {
      if (clubDataActivo(d.data() as Record<string, unknown>)) {
        clubesActivosEnPanel++
      }
    }
    let clubesConContadorReseteado = 0
    const clubDocs = clubSnap.docs
    for (let i = 0; i < clubDocs.length; i += BATCH_FIRESTORE_OP) {
      const chunk = clubDocs.slice(i, i + BATCH_FIRESTORE_OP)
      const b = db.batch()
      for (const d of chunk) {
        b.set(
          d.ref,
          { miembros: 0, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        clubesConContadorReseteado++
      }
      await b.commit()
    }

    await panelSincronizarTrasVaciarTodos(clubSnap.size, clubesActivosEnPanel)

    return { ok: true, documentosEliminados, clubesConContadorReseteado }
  } catch (error) {
    console.error('vaciarTodosLosMiembrosClubEnFirestore', error)
    return { ok: false, codigo: 'error' }
  }
}

export type ResultadoNormalizacionMasiva = {
  revisados: number
  modificados: number
  cambios: { id: string; antes: string; despues: string }[]
}

/**
 * Preview: retorna los cambios que se harían sin aplicarlos.
 * Si `aplicar` es true, escribe las correcciones en Firestore.
 */
export async function normalizarNombresMasivoClub(
  clubId: string,
  aplicar: boolean,
): Promise<ResultadoNormalizacionMasiva> {
  const db = getAdminFirestore()
  const snap = await db
    .collection(COLECCIONES.miembrosClub)
    .where('clubId', '==', clubId)
    .get()

  const cambios: ResultadoNormalizacionMasiva['cambios'] = []
  const updates: { ref: FirebaseFirestore.DocumentReference; nombre: string; apellidos: string }[] = []

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>
    const nombreOrig = str(data.nombre)
    const apellidosOrig = str(data.apellidos)
    const nombreNorm = normalizarNombrePersona(nombreOrig)
    const apellidosNorm = normalizarNombrePersona(apellidosOrig)

    if (nombreOrig !== nombreNorm || apellidosOrig !== apellidosNorm) {
      cambios.push({
        id: doc.id,
        antes: `${nombreOrig} ${apellidosOrig}`,
        despues: `${nombreNorm} ${apellidosNorm}`,
      })
      updates.push({ ref: doc.ref, nombre: nombreNorm, apellidos: apellidosNorm })
    }
  }

  if (aplicar && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH_FIRESTORE_OP) {
      const chunk = updates.slice(i, i + BATCH_FIRESTORE_OP)
      const batch = db.batch()
      for (const u of chunk) {
        batch.update(u.ref, { nombre: u.nombre, apellidos: u.apellidos, updatedAt: FieldValue.serverTimestamp() })
      }
      await batch.commit()
    }
  }

  return { revisados: snap.size, modificados: cambios.length, cambios }
}
