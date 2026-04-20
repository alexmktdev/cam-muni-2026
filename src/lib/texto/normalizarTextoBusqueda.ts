/** Minúsculas, sin tildes, trim (búsqueda tolerante a acentos). */
export function normalizarTextoBusqueda(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
