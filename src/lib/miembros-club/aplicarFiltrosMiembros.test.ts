import { describe, expect, it } from 'vitest'
import { aplicarFiltrosMiembros } from '@/lib/miembros-club/aplicarFiltrosMiembros'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

function m(partial: Partial<MiembroClubCliente> & Pick<MiembroClubCliente, 'id'>): MiembroClubCliente {
  return {
    clubId: 'c',
    nombre: 'N',
    apellidos: 'A',
    rut: '111111111',
    rutFormateado: '11.111.111-1',
    fechaNacimiento: null,
    edad: null,
    telefono: null,
    sector: null,
    ...partial,
  }
}

describe('aplicarFiltrosMiembros', () => {
  const base: MiembroClubCliente[] = [
    m({ id: '1', edad: 70, sector: 'Villa Norte', fechaNacimiento: '1954-06-01' }),
    m({ id: '2', edad: 55, sector: 'Centro', fechaNacimiento: '1969-12-31' }),
    m({ id: '3', edad: null, sector: null, fechaNacimiento: null }),
  ]

  it('filtra por edad mínima y máxima', () => {
    const r = aplicarFiltrosMiembros(base, { edadMin: 60, edadMax: 75 })
    expect(r.map((x) => x.id)).toEqual(['1'])
  })

  it('excluye edad null cuando hay límite de edad', () => {
    const r = aplicarFiltrosMiembros(base, { edadMin: 0, edadMax: 100 })
    expect(r.map((x) => x.id)).toEqual(['1', '2'])
    const soloMin = aplicarFiltrosMiembros(base, { edadMin: 50 })
    expect(soloMin.map((x) => x.id)).not.toContain('3')
  })

  it('sector parcial e insensible a mayúsculas', () => {
    const r = aplicarFiltrosMiembros(base, { sector: 'norte' })
    expect(r.map((x) => x.id)).toEqual(['1'])
  })

  it('rango de fecha de nacimiento YYYY-MM-DD', () => {
    const r = aplicarFiltrosMiembros(base, { fechaDesde: '1954-01-01', fechaHasta: '1955-01-01' })
    expect(r.map((x) => x.id)).toEqual(['1'])
  })

  it('sin coincidencias devuelve array vacío', () => {
    expect(aplicarFiltrosMiembros(base, { sector: 'inexistente' })).toEqual([])
  })
})
