/**
 * Decodifica el payload de un JWT sin verificar firma (solo diagnóstico en servidor).
 */
export function decodeJwtPayloadUnsafe(
  token: string,
): { aud?: string; iss?: string; sub?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) {
      return null
    }
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json) as { aud?: string; iss?: string; sub?: string }
    return payload
  } catch {
    return null
  }
}
