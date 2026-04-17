import 'server-only'
// Force refresh build

import { getAdminFirestore } from '@/lib/firebase/adminFirebase'
import { COLECCIONES } from '@/constants'
import { FieldValue } from 'firebase-admin/firestore'
import {
  listClubesFromFirestore,
  normalizarNombreClubCam,
} from '@/services/club.service'
import { parsearCsvTexto } from '@/lib/csv/parseCsvLineas'
import { partirNombreCompletoCsv } from '@/lib/miembros-club/partirNombreCompleto'
import { normalizarRutChile } from '@/lib/validation/chileRut'
import {
  incrementarContadorMiembrosEnClub,
  cargarRutsDelClub,
} from '@/services/miembro-club.service'

const BATCH_CSV_WRITES = 500

export type ResultadoImportMasivo = {
  agregados: number
  omitidosDuplicado: number
  clubesNoEncontradosEnRenglon: number
  filasConErrorSevero: number
  errores: string[]
}

const MAX_ERRORES = 100

export async function importarMasivoDesdeCsv(
  textoCsv: string,
): Promise<ResultadoImportMasivo> {
  const errores: string[] = []
  
  // Limite muy alto para soportar archivos globales.
  const { filas } = parsearCsvTexto(textoCsv, 10000)

  if (filas.length < 2) {
    return {
      agregados: 0,
      omitidosDuplicado: 0,
      clubesNoEncontradosEnRenglon: 0,
      filasConErrorSevero: 0,
      errores: ['El archivo CSV debe incluir una fila de encabezados y al menos una fila de datos.'],
    }
  }

  // Identificar columnas. Buscamos rut, nombre y clubes asociados de forma aproximada o exacta por indice.
  const headers = filas[0]!.map((h) => h.toLowerCase().trim())
  
  // Detectar dinamicamente en que columna cayo cada cosa segun el CSV de ejemplo del usuario.
  let colRut = headers.findIndex((h) => h.includes('rut') || h.includes('run'))
  let colNombre = headers.findIndex((h) => h.includes('nombre') && !h.includes('club'))
  let colClubes = headers.findIndex((h) => h.includes('clubes') || h.includes('asociados') || h.includes('club'))

  // Fallback a los indices fijos del ejemplo provisto en `datos.csv`
  if (colRut === -1) colRut = 2
  if (colNombre === -1) colNombre = 3
  if (colClubes === -1) colClubes = 4

  const db = getAdminFirestore()
  const col = db.collection(COLECCIONES.miembrosClub)
  
  // 1. Obtener el catalogo completo de clubes para enlazar a sus IDs.
  const listaClubes = await listClubesFromFirestore()
  
  // Crear mapa indexado de nombre limpio => clubId para saltar busquedas lineales lentas.
  const mapClubesPorNombre = new Map<string, string>()
  const mapClubesPorSlug = new Map<string, string>()
  
  for (const c of listaClubes) {
    mapClubesPorNombre.set(c.nombre.toLowerCase(), c.id)
    if (c.slugUrl) {
      mapClubesPorSlug.set(c.slugUrl.toLowerCase(), c.id)
    }
  }

  // Controlar cuantas inserciones se hicieron en cada club particular para actualizar sus dashboards al final.
  const mapContadoresPorClubId = new Map<string, number>()

  let agregados = 0
  let omitidosDuplicado = 0
  let clubesNoEncontradosEnRenglon = 0
  let filasConErrorSevero = 0

  let batch = db.batch()
  let opsEnBatch = 0

  async function flushBatch() {
    if (opsEnBatch > 0) {
      await batch.commit()
      batch = db.batch()
      opsEnBatch = 0
    }
  }

  // Prevenir que 2 renglones en el CSV manden la insercion del mismo rut al mismo club.
  const cacheRutEnClubYaImportadoEstaVez = new Set<string>()

  // Pre-cargar RUTs existentes de cada club implicado (1 query por club vs N queries individuales).
  const rutsExistentesPorClub = new Map<string, Set<string>>()
  async function obtenerRutsClub(clubId: string): Promise<Set<string>> {
    let s = rutsExistentesPorClub.get(clubId)
    if (!s) {
      s = await cargarRutsDelClub(clubId)
      rutsExistentesPorClub.set(clubId, s)
    }
    return s
  }

  // 2. Iterar renglón a renglón.
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]!
    const linea = i + 1

    const rutRaw = (fila[colRut] ?? '').trim()
    const nombreFull = (fila[colNombre] ?? '').trim()
    const clubesCadenaRaw = fila[colClubes] ?? ''

    // Saltar renglones totalmente en blanco
    if (!rutRaw && !nombreFull && fila.every((c) => !String(c).trim())) {
      continue
    }

    if (!nombreFull && !rutRaw) {
      filasConErrorSevero++
      if (errores.length < MAX_ERRORES) errores.push(`Fila ${linea}: No cuenta ni con nombre ni con RUT. Omitida.`)
      continue
    }

    const rut = normalizarRutChile(rutRaw)

    // Dividimos la cadena "CDC | LOS AROMOS" por el separador genérico.
    const clubesParseados = clubesCadenaRaw.split('|').map(s => s.trim()).filter(Boolean)
    
    if (clubesParseados.length === 0) {
      filasConErrorSevero++
      if (errores.length < MAX_ERRORES) errores.push(`Fila ${linea}: RUT ${rut} no tiene ningun club asignado. Omitido.`)
      continue
    }

    const { nombre, apellidos } = partirNombreCompletoCsv(nombreFull)

    for (const nomClubTxt of clubesParseados) {
      // Regla de Negocio: Agregar el formato CAM al texto y buscar contra el catalogo local.
      const clubBuscado = normalizarNombreClubCam(nomClubTxt)
      const clubBuscadoLw = clubBuscado.toLowerCase()
      
      const clubId = mapClubesPorNombre.get(clubBuscadoLw) || mapClubesPorSlug.get(clubBuscadoLw)
      
      if (!clubId) {
        clubesNoEncontradosEnRenglon++
        if (errores.length < MAX_ERRORES) errores.push(`Fila ${linea}: Club "${nomClubTxt}" no existe en la base de datos como "${clubBuscado}". Omitiendo esta asgnación para RUT ${rut}.`)
        continue
      }

      // Evitar crear dobles inserciones en el batch en cache local (si el archivo tenia doble fila)
      const claveUnica = `${clubId}_${rut}`
      if (cacheRutEnClubYaImportadoEstaVez.has(claveUnica)) {
        omitidosDuplicado++
        continue
      }
      
      const rutsClub = await obtenerRutsClub(clubId)
      if (rutsClub.has(rut)) {
        omitidosDuplicado++
        cacheRutEnClubYaImportadoEstaVez.add(claveUnica)
        continue
      }

      // Agregar inserción al Batch actual.
      cacheRutEnClubYaImportadoEstaVez.add(claveUnica)
      
      const ref = col.doc()
      batch.set(ref, {
        clubId,
        nombre,
        apellidos,
        rut,
        // AlMACENAMIENTO NORMALIZADO:
        // Seguimos aceptando cualquier RUT (sin rebotar), pero le quitamos puntos y guiones por consistencia.
        createdAt: FieldValue.serverTimestamp(),
      })
      
      opsEnBatch++
      agregados++

      mapContadoresPorClubId.set(clubId, (mapContadoresPorClubId.get(clubId) || 0) + 1)

      if (opsEnBatch >= BATCH_CSV_WRITES) {
        await flushBatch()
      }
    }
  }

  // Vaciar cualquier batch sobrante de la última pasada.
  await flushBatch()

  // 3. Sincronización Post-carga: Actualizar contadores totales ("miembros: N") en los clubes implicados.
  for (const [clubId, totalAñadidos] of mapContadoresPorClubId.entries()) {
    if (totalAñadidos > 0) {
      await incrementarContadorMiembrosEnClub(clubId, totalAñadidos)
    }
  }

  return {
    agregados,
    omitidosDuplicado,
    clubesNoEncontradosEnRenglon,
    filasConErrorSevero,
    errores: errores.slice(0, MAX_ERRORES),
  }
}
