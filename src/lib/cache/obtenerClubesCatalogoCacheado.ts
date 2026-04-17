import 'server-only'

import { unstable_cache } from 'next/cache'
import { TAG_CACHE_CLUBES_CATALOGO } from '@/lib/cache/clubesCatalogo'
import { listClubesFromFirestore } from '@/services/club.service'

/**
 * Catálogo completo de clubes cacheado 30 min; se invalida con
 * `TAG_CACHE_CLUBES_CATALOGO` tras mutaciones.
 */
export const obtenerClubesCatalogoCacheado = unstable_cache(
  () => listClubesFromFirestore(),
  ['clubes-catalogo-layout-v1'],
  { revalidate: 1800, tags: [TAG_CACHE_CLUBES_CATALOGO] },
)
