import { calcularEdad } from '@/lib/fecha/calcularEdad'
import { formatearRutMostrar, normalizarRutChile } from '@/lib/validation/chileRut'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw.trim() : fallback
}

export function mapMiembroDocToCliente(
  id: string,
  data: Record<string, unknown>,
): MiembroClubCliente | null {
  const clubId = str(data.clubId)
  const nombre = str(data.nombre) || str(data.nombres)
  const apellidos = str(data.apellidos) || str(data.apellido)
  const rut = normalizarRutChile(str(data.rut))
  if (!clubId || !nombre || !apellidos || !rut) {
    return null
  }
  const fechaNacimiento = str(data.fechaNacimiento) || null
  return {
    id,
    clubId,
    nombre,
    apellidos,
    rut,
    rutFormateado: formatearRutMostrar(rut),
    fechaNacimiento,
    edad: calcularEdad(fechaNacimiento),
    telefono: str(data.telefono) || null,
    sector: str(data.sector) || null,
  }
}
