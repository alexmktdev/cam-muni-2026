/**
 * Title Case inteligente para nombres chilenos.
 * Capitaliza la primera letra de cada palabra excepto partículas como
 * "de", "del", "de la", "de los", "de las", "y" (salvo al inicio).
 */

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

export function normalizarNombrePersona(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (!limpio) {
    return ''
  }

  const palabras = limpio.split(' ')
  const resultado: string[] = []

  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i]!.toLowerCase()
    if (i > 0 && PARTICULAS.has(palabra)) {
      resultado.push(palabra)
    } else {
      resultado.push(capitalizarPalabra(palabra))
    }
  }

  return resultado.join(' ')
}

function capitalizarPalabra(palabra: string): string {
  if (palabra.length === 0) {
    return ''
  }
  return palabra.charAt(0).toUpperCase() + palabra.slice(1)
}
