import { describe, expect, it } from 'vitest'
import { mapMiembroDocToCliente } from '@/lib/miembros-club/mapMiembroDocToCliente'

describe('mapMiembroDocToCliente', () => {
  it('mapea documento completo con nombres/apellidos estándar', () => {
    const m = mapMiembroDocToCliente('doc1', {
      clubId: 'c1',
      nombre: 'Juan',
      apellidos: 'Pérez',
      rut: '11.111.111-1',
      fechaNacimiento: '1950-05-10',
      telefono: '912345678',
      sector: 'Centro',
    })
    expect(m).toMatchObject({
      id: 'doc1',
      clubId: 'c1',
      nombre: 'Juan',
      apellidos: 'Pérez',
      rut: '111111111',
      fechaNacimiento: '1950-05-10',
      telefono: '912345678',
      sector: 'Centro',
    })
    expect(m?.rutFormateado).toMatch(/11\.111\.111-1/)
    expect(typeof m?.edad).toBe('number')
  })

  it('acepta nombres/apellidos en campos alternativos', () => {
    const m = mapMiembroDocToCliente('d2', {
      clubId: 'c1',
      nombres: 'Ana',
      apellido: 'López',
      rut: '111111111',
    })
    expect(m).toMatchObject({ nombre: 'Ana', apellidos: 'López' })
  })

  it('devuelve null si falta clubId, nombre, apellidos o rut', () => {
    expect(mapMiembroDocToCliente('x', { clubId: '', nombre: 'A', apellidos: 'B', rut: '111111111' })).toBeNull()
    expect(mapMiembroDocToCliente('x', { clubId: 'c', nombre: '', apellidos: 'B', rut: '111111111' })).toBeNull()
    expect(mapMiembroDocToCliente('x', { clubId: 'c', nombre: 'A', apellidos: '', rut: '111111111' })).toBeNull()
    expect(mapMiembroDocToCliente('x', { clubId: 'c', nombre: 'A', apellidos: 'B', rut: '' })).toBeNull()
  })
})
