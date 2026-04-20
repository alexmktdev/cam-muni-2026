#!/usr/bin/env node
/**
 * Comprobaciones básicas de seguridad contra una instancia Next.js en marcha.
 *
 * NO sustituye un pentest profesional, OWASP ZAP, ni auditoría de Firebase.
 * Sirve para detectar regresiones obvias (APIs abiertas, cabeceras ausentes, etc.).
 *
 * Uso:
 *   npm run test:security
 *   BASE_URL=http://localhost:3001 node scripts/security-check.mjs
 *   node scripts/security-check.mjs http://127.0.0.1:3000
 */

const BASE_URL = (process.env.BASE_URL || process.argv[2] || 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const stats = { ok: 0, fail: 0, warn: 0 }

function ok(msg) {
  console.log(`✓ ${msg}`)
  stats.ok++
}

function bad(msg, detail) {
  console.error(`✗ ${msg}${detail != null ? ` → ${detail}` : ''}`)
  stats.fail++
}

function warn(msg, detail) {
  console.warn(`⚠ ${msg}${detail != null ? ` → ${detail}` : ''}`)
  stats.warn++
}

async function main() {
  console.log(`Objetivo: ${BASE_URL}\n`)

  // --- APIs: sin cookie de sesión ---
  let r = await fetch(`${BASE_URL}/api/data`, { redirect: 'manual' })
  if (r.status === 401) ok('GET /api/data sin cookie → 401')
  else bad('GET /api/data sin cookie debe ser 401', `status ${r.status}`)

  r = await fetch(`${BASE_URL}/api/auth/verify`, { redirect: 'manual' })
  if (r.status === 401) ok('GET /api/auth/verify sin cookie → 401')
  else bad('GET /api/auth/verify sin cookie debe ser 401', `status ${r.status}`)

  r = await fetch(`${BASE_URL}/api/shell-context`, { redirect: 'manual' })
  if (r.status === 401) ok('GET /api/shell-context sin cookie → 401')
  else bad('GET /api/shell-context sin cookie debe ser 401', `status ${r.status}`)

  // --- Crear sesión: cuerpos inválidos o token falso ---
  r = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  })
  if (r.status === 401) ok('POST /api/auth/session cuerpo vacío / JSON inválido → 401')
  else bad('POST /api/auth/session cuerpo vacío', `status ${r.status}`)

  r = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (r.status === 401) ok('POST /api/auth/session sin idToken (Zod) → 401')
  else bad('POST /api/auth/session sin idToken', `status ${r.status}`)

  r = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'token-falso-no-jwt' }),
  })
  if (r.status === 401) ok('POST /api/auth/session idToken inválido → 401')
  else bad('POST /api/auth/session idToken inválido', `status ${r.status}`)

  // --- Cookie falsificada (no debe aceptar valor arbitrario) ---
  r = await fetch(`${BASE_URL}/api/data`, {
    redirect: 'manual',
    headers: { Cookie: 'sesion-auth=valor-falso-manipulado' },
  })
  if (r.status === 401) ok('GET /api/data con cookie manipulada → 401')
  else bad('GET /api/data con cookie falsa', `status ${r.status}`)

  // --- Ruta protegida: middleware redirige a login ---
  r = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' })
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get('location') || ''
    if (/\/login/i.test(loc)) ok('GET /dashboard sin sesión → redirección a /login')
    else bad('Redirección /dashboard', `Location inesperada: ${loc}`)
  } else {
    bad('GET /dashboard sin sesión', `se esperaba 3xx, obtuve ${r.status}`)
  }

  // --- Cabeceras de seguridad (next.config) en página HTML ---
  r = await fetch(`${BASE_URL}/login`, { redirect: 'manual' })
  const xfo = r.headers.get('x-frame-options')
  const xcto = r.headers.get('x-content-type-options')
  const rp = r.headers.get('referrer-policy')

  if (xfo && xfo.toUpperCase() === 'DENY') ok('X-Frame-Options: DENY')
  else bad('X-Frame-Options', xfo ?? 'ausente')

  if (xcto && xcto.toLowerCase() === 'nosniff') ok('X-Content-Type-Options: nosniff')
  else bad('X-Content-Type-Options', xcto ?? 'ausente')

  if (rp && rp.toLowerCase().includes('strict-origin')) ok('Referrer-Policy configurada')
  else warn('Referrer-Policy', rp ?? 'ausente o distinta a la esperada')

  // --- Respuesta 401 genérica (no filtrar stack / Firebase al cliente) ---
  r = await fetch(`${BASE_URL}/api/data`)
  if (r.status === 401) {
    let body
    try {
      body = await r.json()
    } catch {
      body = {}
    }
    const err = typeof body.error === 'string' ? body.error : ''
    const filtra = /firebase|private_key|stack|credential|admin/i.test(err)
    if (err && !filtra) ok('GET /api/data 401: cuerpo genérico (sin filtrar secretos obvios)')
    else if (filtra) bad('GET /api/data 401: el mensaje podría filtrar demasiado detalle', err)
    else warn('GET /api/data 401', 'sin campo error en JSON')
  }

  // --- DELETE sesión sin cookie: tu API devuelve 200 (diseño permisivo) ---
  r = await fetch(`${BASE_URL}/api/auth/session`, { method: 'DELETE', redirect: 'manual' })
  if (r.ok) {
    warn(
      'DELETE /api/auth/session sin cookie',
      'responde OK (válido para “cerrar sesión siempre”; revisa si quieres 401 en APIs más estrictas)',
    )
  }

  console.log('\n--- Resumen ---')
  console.log(`Correctas: ${stats.ok} | Fallos: ${stats.fail} | Avisos: ${stats.warn}`)
  if (stats.fail > 0) {
    console.error('\nHay fallos: revisa la app o la URL (¿mismo puerto que npm run dev?).')
    process.exit(1)
  }
  console.log('\nListo. Recuerda: esto es un humo-test, no una auditoría completa.')
}

main().catch((e) => {
  console.error('Error ejecutando pruebas:', e.message)
  process.exit(1)
})
