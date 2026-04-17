'use client'

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { TextField } from '@/components/ui/TextField'
import { SugerenciaOrtografica } from '@/components/ui/SugerenciaOrtografica'
import { calcularEdad } from '@/lib/fecha/calcularEdad'
import { esRutChilenoValido } from '@/lib/validation/chileRut'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

type Sugerencia = { offset: number; length: number; mensaje: string; reemplazos: string[] }

export interface EditarMiembroClubModalProps {
  miembro: MiembroClubCliente | null
  onClose: () => void
  onGuardado?: (m: MiembroClubCliente) => void
}

async function revisarOrtografia(texto: string): Promise<Sugerencia[]> {
  if (!texto.trim()) return []
  try {
    const res = await fetch('/api/ortografia/revisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ texto }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { sugerencias?: Sugerencia[] }
    return data.sugerencias ?? []
  } catch {
    return []
  }
}

export function EditarMiembroClubModal({
  miembro,
  onClose,
  onGuardado,
}: EditarMiembroClubModalProps) {
  const baseId = useId()
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [rut, setRut] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [sector, setSector] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rutError, setRutError] = useState<string | null>(null)
  const [sugNombre, setSugNombre] = useState<Sugerencia[]>([])
  const [sugApellidos, setSugApellidos] = useState<Sugerencia[]>([])

  useEffect(() => {
    if (miembro) {
      setNombre(miembro.nombre)
      setApellidos(miembro.apellidos)
      setRut(miembro.rutFormateado)
      setFechaNacimiento(miembro.fechaNacimiento ?? '')
      setTelefono(miembro.telefono ?? '')
      setSector(miembro.sector ?? '')
      setError(null)
      setRutError(null)
      setSugNombre([])
      setSugApellidos([])
    }
  }, [miembro])

  function validarRut(valor: string) {
    setRut(valor)
    if (!valor.trim()) {
      setRutError(null)
      return
    }
    setRutError(
      esRutChilenoValido(valor) ? null : 'RUT inválido: el dígito verificador no coincide.',
    )
  }

  const onBlurNombre = useCallback(async () => {
    setSugNombre(await revisarOrtografia(nombre))
  }, [nombre])

  const onBlurApellidos = useCallback(async () => {
    setSugApellidos(await revisarOrtografia(apellidos))
  }, [apellidos])

  const edadCalculada = useMemo(
    () => calcularEdad(fechaNacimiento || null),
    [fechaNacimiento],
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!miembro) {
      return
    }
    setError(null)
    if (!esRutChilenoValido(rut)) {
      setError('El RUT ingresado no es válido (dígito verificador incorrecto).')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/miembros-club/${encodeURIComponent(miembro.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre,
          apellidos,
          rut,
          fechaNacimiento: fechaNacimiento || null,
          telefono: telefono || null,
          sector: sector || null,
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        miembro?: MiembroClubCliente | null
      } | null
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo actualizar')
        return
      }
      if (data?.miembro) {
        onGuardado?.(data.miembro)
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!miembro) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${baseId}-titulo`}
      onClick={(ev) => {
        if (!loading && ev.target === ev.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={`${baseId}-titulo`} className="text-lg font-bold text-blue-900">
          Editar miembro
        </h2>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div>
            <TextField
              fieldId={`${baseId}-nombre`}
              label="Nombres"
              value={nombre}
              onChange={(ev) => setNombre(ev.target.value)}
              onBlur={() => void onBlurNombre()}
              required
              maxLength={100}
              className="font-normal"
            />
            <SugerenciaOrtografica
              sugerencias={sugNombre}
              onAceptar={(texto) => { setNombre(texto); setSugNombre([]) }}
              textoOriginal={nombre}
            />
          </div>
          <div>
            <TextField
              fieldId={`${baseId}-apellidos`}
              label="Apellidos"
              value={apellidos}
              onChange={(ev) => setApellidos(ev.target.value)}
              onBlur={() => void onBlurApellidos()}
              required
              maxLength={120}
              className="font-normal"
            />
            <SugerenciaOrtografica
              sugerencias={sugApellidos}
              onAceptar={(texto) => { setApellidos(texto); setSugApellidos([]) }}
              textoOriginal={apellidos}
            />
          </div>
          <div>
            <TextField
              fieldId={`${baseId}-rut`}
              label="RUT"
              value={rut}
              onChange={(ev) => validarRut(ev.target.value)}
              required
              maxLength={20}
              className="font-normal"
            />
            {rutError ? (
              <p className="mt-1 text-xs text-red-600">{rutError}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              fieldId={`${baseId}-fechaNacimiento`}
              label="Fecha de nacimiento"
              type="date"
              value={fechaNacimiento}
              onChange={(ev) => setFechaNacimiento(ev.target.value)}
              className="font-normal"
            />
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${baseId}-edad`}
                className="text-sm font-medium text-slate-700"
              >
                Edad
              </label>
              <input
                id={`${baseId}-edad`}
                type="text"
                readOnly
                tabIndex={-1}
                aria-label="Edad en años, calculada automáticamente, no editable"
                value={
                  edadCalculada != null
                    ? `${edadCalculada} ${edadCalculada === 1 ? 'año' : 'años'}`
                    : '—'
                }
                className="cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none"
              />
              <p className="text-xs text-slate-500">
                Se calcula automáticamente según la fecha de nacimiento.
              </p>
            </div>
          </div>
          <TextField
            fieldId={`${baseId}-telefono`}
            label="Teléfono de contacto"
            value={telefono}
            onChange={(ev) => setTelefono(ev.target.value)}
            maxLength={30}
            placeholder="+56 9 1234 5678"
            className="font-normal"
            autoComplete="tel"
          />
          <TextField
            fieldId={`${baseId}-sector`}
            label="Sector donde reside"
            value={sector}
            onChange={(ev) => setSector(ev.target.value)}
            maxLength={150}
            placeholder="Ej: Villa Los Aromos"
            className="font-normal"
          />
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <p className="text-[10px] text-slate-400">
            Corrección ortográfica con{' '}
            <a href="https://languagetool.org" target="_blank" rel="noopener" className="underline">
              LanguageTool
            </a>
          </p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
