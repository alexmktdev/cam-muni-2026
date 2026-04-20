import { describe, expect, it } from 'vitest'
import { normalizarTextoBusqueda } from '@/lib/texto/normalizarTextoBusqueda'

describe('normalizarTextoBusqueda', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarTextoBusqueda('José María')).toBe('jose maria')
    expect(normalizarTextoBusqueda('Ñuñoa')).toBe('nunoa')
  })

  it('recorta espacios extremos', () => {
    expect(normalizarTextoBusqueda('  Ana  ')).toBe('ana')
  })
})
