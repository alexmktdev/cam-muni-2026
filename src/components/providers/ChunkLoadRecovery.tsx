'use client'

import { useEffect } from 'react'

const RETRIES_KEY = '__next_chunk_load_retries'
const MAX_RETRIES = 2

function esErrorCargaChunk(mensaje: string): boolean {
  return /ChunkLoadError|Loading chunk .+ failed|timeout:.*\/_next\/static\/chunks|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    mensaje,
  )
}

/**
 * Tras un reinicio de `next dev` o caché vieja, el navegador puede pedir chunks que ya no existen
 * y mostrar ChunkLoadError. Una recarga suele alinear hashes; limitamos reintentos para no buclear.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      sessionStorage.removeItem(RETRIES_KEY)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const intentarRecargar = (mensaje: string) => {
      if (!esErrorCargaChunk(mensaje)) {
        return
      }
      const n = parseInt(sessionStorage.getItem(RETRIES_KEY) ?? '0', 10)
      if (n >= MAX_RETRIES) {
        return
      }
      sessionStorage.setItem(RETRIES_KEY, String(n + 1))
      window.location.reload()
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const r = event.reason
      const msg =
        r && typeof r === 'object' && 'message' in r
          ? String((r as Error).message)
          : String(r ?? '')
      intentarRecargar(msg)
    }

    const onError = (event: ErrorEvent) => {
      intentarRecargar(event.message ?? '')
    }

    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}
