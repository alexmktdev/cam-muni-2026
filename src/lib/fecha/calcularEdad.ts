/**
 * Calcula la edad en años cumplidos a partir de una fecha YYYY-MM-DD.
 * Considera mes y día exacto para no sumar un año antes de la fecha de cumpleaños.
 * Retorna null si el formato es inválido.
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento)
  if (!match) {
    return null
  }
  const anio = parseInt(match[1]!, 10)
  const mes = parseInt(match[2]!, 10) - 1
  const dia = parseInt(match[3]!, 10)
  const nacimiento = new Date(anio, mes, dia)
  if (Number.isNaN(nacimiento.getTime())) {
    return null
  }

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mesActual = hoy.getMonth()
  const diaActual = hoy.getDate()

  if (mesActual < mes || (mesActual === mes && diaActual < dia)) {
    edad--
  }

  return edad >= 0 ? edad : null
}
