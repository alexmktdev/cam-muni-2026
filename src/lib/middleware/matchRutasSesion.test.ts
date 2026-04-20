import { describe, expect, it } from 'vitest'
import { esRutaAutenticacion, esRutaProtegida } from '@/lib/middleware/matchRutasSesion'

describe('matchRutasSesion', () => {
  it('marca /dashboard y subrutas como protegidas', () => {
    expect(esRutaProtegida('/dashboard')).toBe(true)
    expect(esRutaProtegida('/dashboard/foo')).toBe(true)
  })

  it('marca /admin y subrutas como protegidas', () => {
    expect(esRutaProtegida('/admin')).toBe(true)
    expect(esRutaProtegida('/admin/miembros/busqueda')).toBe(true)
  })

  it('no protege / ni /login', () => {
    expect(esRutaProtegida('/')).toBe(false)
    expect(esRutaProtegida('/login')).toBe(false)
  })

  it('login y forgot-password son rutas de autenticación', () => {
    expect(esRutaAutenticacion('/login')).toBe(true)
    expect(esRutaAutenticacion('/forgot-password')).toBe(true)
  })

  it('dashboard no es ruta de autenticación', () => {
    expect(esRutaAutenticacion('/dashboard')).toBe(false)
  })
})
