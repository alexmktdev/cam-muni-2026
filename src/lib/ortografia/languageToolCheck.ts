import 'server-only'

/**
 * Wrapper para la API pública de LanguageTool (corrección ortográfica en español).
 * Se ejecuta solo en el servidor para no exponer el uso de la API al cliente.
 * Si la API falla o no responde, retorna un array vacío (no bloquea el flujo).
 */

const LANGUAGETOOL_URL = 'https://api.languagetool.org/v2/check'
const TIMEOUT_MS = 4000

export type SugerenciaOrtografica = {
  offset: number
  length: number
  mensaje: string
  reemplazos: string[]
}

type LTMatch = {
  message?: string
  offset?: number
  length?: number
  replacements?: { value?: string }[]
}

type LTResponse = {
  matches?: LTMatch[]
}

export async function verificarOrtografia(texto: string): Promise<SugerenciaOrtografica[]> {
  if (!texto.trim()) {
    return []
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(LANGUAGETOOL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: texto, language: 'es' }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      return []
    }

    const data = (await res.json()) as LTResponse
    if (!Array.isArray(data.matches)) {
      return []
    }

    return data.matches
      .filter(
        (m): m is LTMatch & { offset: number; length: number } =>
          typeof m.offset === 'number' && typeof m.length === 'number',
      )
      .map((m) => ({
        offset: m.offset,
        length: m.length,
        mensaje: typeof m.message === 'string' ? m.message : 'Posible error ortográfico',
        reemplazos: Array.isArray(m.replacements)
          ? m.replacements.filter((r) => typeof r.value === 'string').map((r) => r.value!)
          : [],
      }))
  } catch {
    return []
  }
}
