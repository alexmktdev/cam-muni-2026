'use client'

type Sugerencia = {
  offset: number
  length: number
  mensaje: string
  reemplazos: string[]
}

export interface SugerenciaOrtograficaProps {
  sugerencias: Sugerencia[]
  textoOriginal: string
  onAceptar: (textoCorregido: string) => void
}

function aplicarReemplazo(texto: string, sug: Sugerencia, reemplazo: string): string {
  return texto.slice(0, sug.offset) + reemplazo + texto.slice(sug.offset + sug.length)
}

export function SugerenciaOrtografica({
  sugerencias,
  textoOriginal,
  onAceptar,
}: SugerenciaOrtograficaProps) {
  if (sugerencias.length === 0) {
    return null
  }

  return (
    <div className="mt-1.5 space-y-1">
      {sugerencias.map((sug, i) => (
        <div
          key={`${sug.offset}-${i}`}
          className="flex flex-wrap items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
        >
          <span className="shrink-0 font-medium">{sug.mensaje}</span>
          {sug.reemplazos.slice(0, 3).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onAceptar(aplicarReemplazo(textoOriginal, sug, r))}
              className="rounded bg-amber-200/70 px-1.5 py-0.5 font-semibold transition hover:bg-amber-300"
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAceptar(textoOriginal)}
            className="ml-auto text-[10px] text-amber-700 underline"
          >
            Ignorar
          </button>
        </div>
      ))}
    </div>
  )
}
