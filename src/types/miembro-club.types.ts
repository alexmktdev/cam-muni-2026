// Miembro de un club (adulto mayor) — DTO para UI.

export type MiembroClubCliente = {
  id: string
  clubId: string
  nombre: string
  apellidos: string
  /** RUT normalizado sin puntos ni guion (p. ej. 123456789K). */
  rut: string
  /** Para mostrar en tabla. */
  rutFormateado: string
  /** Fecha de nacimiento en formato YYYY-MM-DD; null si no se registró. */
  fechaNacimiento: string | null
  /** Edad calculada al vuelo desde fechaNacimiento; null si no hay fecha. */
  edad: number | null
  /** Teléfono de contacto (formato libre). */
  telefono: string | null
  /** Sector, villa o población donde reside. */
  sector: string | null
}
