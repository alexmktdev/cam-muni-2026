// Directiva de un CAM — DTO para UI.

export type CargoDirectiva =
  | 'presidente'
  | 'vicepresidente'
  | 'secretario'
  | 'tesorero'
  | 'director'
  | 'otro'

export const CARGOS_DIRECTIVA: { valor: CargoDirectiva; etiqueta: string }[] = [
  { valor: 'presidente', etiqueta: 'Presidente/a' },
  { valor: 'vicepresidente', etiqueta: 'Vicepresidente/a' },
  { valor: 'secretario', etiqueta: 'Secretario/a' },
  { valor: 'tesorero', etiqueta: 'Tesorero/a' },
  { valor: 'director', etiqueta: 'Director/a' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export type MiembroDirectivaCliente = {
  id: string
  cargo: CargoDirectiva
  nombreCompleto: string
  telefono: string
  /** Documento en `miembros_club`; obligatorio para nuevos registros validados. */
  miembroClubId: string | null
}

export type DirectivaClubCliente = {
  clubId: string
  miembros: MiembroDirectivaCliente[]
  lugarReunion: string
  diaReunion: string
  horarioReunion: string
}
