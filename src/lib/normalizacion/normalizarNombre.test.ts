import { describe, expect, it } from 'vitest'
import { normalizarNombrePersona } from './normalizarNombre'

describe('normalizarNombrePersona', () => {
  it('capitaliza palabras simples', () => {
    expect(normalizarNombrePersona('juan carlos')).toBe('Juan Carlos')
  })

  it('deja partículas en minúscula', () => {
    expect(normalizarNombrePersona('maria de los angeles')).toBe('Maria de los Angeles')
  })

  it('capitaliza "de" al inicio', () => {
    expect(normalizarNombrePersona('de la fuente')).toBe('De la Fuente')
  })

  it('maneja "del" como partícula', () => {
    expect(normalizarNombrePersona('jose del carmen')).toBe('Jose del Carmen')
  })

  it('normaliza espacios múltiples', () => {
    expect(normalizarNombrePersona('  ana   maria  ')).toBe('Ana Maria')
  })

  it('retorna vacío para string vacío', () => {
    expect(normalizarNombrePersona('')).toBe('')
    expect(normalizarNombrePersona('   ')).toBe('')
  })

  it('maneja texto ya en Title Case', () => {
    expect(normalizarNombrePersona('Pedro De La Cruz')).toBe('Pedro de la Cruz')
  })

  it('maneja texto completamente en mayúsculas', () => {
    expect(normalizarNombrePersona('ROSA DE LOS RIOS')).toBe('Rosa de los Rios')
  })
})
