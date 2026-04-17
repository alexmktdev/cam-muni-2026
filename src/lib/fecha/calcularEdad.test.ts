import { describe, expect, it } from 'vitest'
import { calcularEdad } from './calcularEdad'

describe('calcularEdad', () => {
  it('retorna null para valores vacíos o null', () => {
    expect(calcularEdad(null)).toBe(null)
    expect(calcularEdad(undefined)).toBe(null)
    expect(calcularEdad('')).toBe(null)
  })

  it('retorna null para formato inválido', () => {
    expect(calcularEdad('01-01-1990')).toBe(null)
    expect(calcularEdad('abc')).toBe(null)
    expect(calcularEdad('1990/01/01')).toBe(null)
  })

  it('calcula correctamente una edad conocida', () => {
    const hoy = new Date()
    const anioNac = hoy.getFullYear() - 65
    const fecha = `${anioNac}-01-01`
    const edad = calcularEdad(fecha)
    expect(edad).toBeGreaterThanOrEqual(64)
    expect(edad).toBeLessThanOrEqual(65)
  })

  it('retorna 0 para un recién nacido hoy', () => {
    const hoy = new Date()
    const y = hoy.getFullYear()
    const m = String(hoy.getMonth() + 1).padStart(2, '0')
    const d = String(hoy.getDate()).padStart(2, '0')
    expect(calcularEdad(`${y}-${m}-${d}`)).toBe(0)
  })

  it('retorna null para fecha futura', () => {
    expect(calcularEdad('2099-12-31')).toBe(null)
  })

  it('no suma un año antes del cumpleaños', () => {
    const hoy = new Date()
    const manana = new Date(hoy)
    manana.setDate(manana.getDate() + 1)
    const anioNac = manana.getFullYear() - 70
    const m = String(manana.getMonth() + 1).padStart(2, '0')
    const d = String(manana.getDate()).padStart(2, '0')
    const edad = calcularEdad(`${anioNac}-${m}-${d}`)
    expect(edad).toBe(69)
  })
})
