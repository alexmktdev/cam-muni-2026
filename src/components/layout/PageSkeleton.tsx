/**
 * Skeleton de página completa para loading.tsx de cada ruta protegida.
 * Replica la estructura de AppMainSection (cabecera + cuerpo gris)
 * con bloques animate-pulse para feedback visual instantáneo.
 */

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ''}`} style={style} />
}

export interface PageSkeletonProps {
  /** Número de filas-skeleton en el cuerpo (por defecto 4). */
  rows?: number
  /** Muestra un bloque de tarjetas tipo dashboard en vez de filas de tabla. */
  cards?: number
}

export function PageSkeleton({ rows = 4, cards }: PageSkeletonProps) {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Cabecera — misma estructura que AppMainHeader */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <Pulse className="mt-0.5 h-7 w-7 shrink-0 sm:mt-1 sm:h-8 sm:w-8" />
          <div className="min-w-0 flex-1">
            <Pulse className="h-6 w-48 sm:h-7" />
            <Pulse className="mt-2 h-4 w-72" />
          </div>
        </div>
      </header>

      {/* Cuerpo — misma bg/padding que AppMainSection */}
      <div className="min-h-0 flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8">
        {cards != null && cards > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cards }, (_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <Pulse className="mb-3 h-4 w-24" />
                <Pulse className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4">
              {Array.from({ length: rows }, (_, i) => (
                <Pulse
                  key={i}
                  className="h-5"
                  style={{ width: `${70 + ((i * 17) % 30)}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
