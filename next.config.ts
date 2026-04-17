// Configuración de Next.js: cabeceras de seguridad en todas las respuestas HTTP.
import type { NextConfig } from 'next'

const siguienteConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Evita que la página se embeba en iframes (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Evita que el navegador adivine tipos MIME distintos al declarado.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limita qué información de referrer se envía en navegación cruzada.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default siguienteConfig
