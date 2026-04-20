import { expect, test } from '@playwright/test'

const rutasProtegidas = [
  '/dashboard',
  '/admin/clubes',
  '/admin/miembros-clubes',
  '/admin/miembros/busqueda',
  '/admin/directivas',
  '/screen-two',
  '/screen-three',
]

test.describe('Rutas públicas y protección', () => {
  test('login muestra formulario de acceso', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /acceso al sistema/i })).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
  })

  test('recuperar contraseña muestra pantalla pública', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: /recuperar/i })).toBeVisible()
  })

  for (const ruta of rutasProtegidas) {
    test(`sin sesión, ${ruta} redirige a login`, async ({ page }) => {
      const res = await page.goto(ruta, { waitUntil: 'commit' })
      expect(res?.status() ?? 0).toBeLessThan(400)
      await page.waitForURL(/\/login/)
      expect(page.url()).toContain('/login')
    })
  }

  test('página de inicio responde', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.ok()).toBeTruthy()
  })

  test('API sesión sin cookie responde 401 en verify', async ({ request }) => {
    const res = await request.get('/api/auth/verify')
    expect(res.status()).toBe(401)
  })
})
