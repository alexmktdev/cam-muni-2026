import type { MiembroClubCliente } from '@/types/miembro-club.types'

export type FiltrosMiembros = {
  edadMin?: number
  edadMax?: number
  sector?: string
  fechaDesde?: string
  fechaHasta?: string
}

export function aplicarFiltrosMiembros(
  miembros: MiembroClubCliente[],
  filtros: FiltrosMiembros,
): MiembroClubCliente[] {
  const sNorm = filtros.sector?.trim().toLowerCase()

  return miembros.filter((m) => {
    if (filtros.edadMin != null && (m.edad == null || m.edad < filtros.edadMin)) {
      return false
    }
    if (filtros.edadMax != null && (m.edad == null || m.edad > filtros.edadMax)) {
      return false
    }

    if (sNorm) {
      if (!m.sector || !m.sector.toLowerCase().includes(sNorm)) {
        return false
      }
    }

    if (filtros.fechaDesde && (!m.fechaNacimiento || m.fechaNacimiento < filtros.fechaDesde)) {
      return false
    }
    if (filtros.fechaHasta && (!m.fechaNacimiento || m.fechaNacimiento > filtros.fechaHasta)) {
      return false
    }

    return true
  })
}
