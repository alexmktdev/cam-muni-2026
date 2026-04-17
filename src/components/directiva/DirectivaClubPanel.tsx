'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { TextField } from '@/components/ui/TextField'
import {
  CARGOS_DIRECTIVA,
  type CargoDirectiva,
  type DirectivaClubCliente,
  type MiembroDirectivaCliente,
} from '@/types/directiva-club.types'
import type { MiembroClubCliente } from '@/types/miembro-club.types'

const MSG_MIEMBRO_NO_REGISTRADO =
  'Antes de agregarlo a la directiva debe registrarlo como miembro en el sistema.'

export interface DirectivaClubPanelProps {
  clubId: string
  puedeGestionar: boolean
}

function filaVacia(index: number): MiembroDirectivaCliente {
  return {
    id: `new-${index}-${Date.now()}`,
    cargo: 'presidente',
    nombreCompleto: '',
    telefono: '',
    miembroClubId: null,
  }
}

async function fetchTodosMiembrosDelClub(clubId: string): Promise<MiembroClubCliente[]> {
  const all: MiembroClubCliente[] = []
  let page = 1
  const limit = 200
  for (;;) {
    const params = new URLSearchParams({
      clubId,
      page: String(page),
      limit: String(limit),
    })
    const res = await fetch(`/api/miembros-club?${params.toString()}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      break
    }
    const data = (await res.json()) as { miembros?: MiembroClubCliente[] }
    const chunk = data.miembros ?? []
    all.push(...chunk)
    if (chunk.length < limit) {
      break
    }
    page += 1
    if (page > 100) {
      break
    }
  }
  return all.sort((a, b) =>
    `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es', {
      sensitivity: 'base',
    }),
  )
}

function etiquetaMiembro(m: MiembroClubCliente): string {
  return `${m.nombre} ${m.apellidos} · ${m.rutFormateado}`
}

export function DirectivaClubPanel({ clubId, puedeGestionar }: DirectivaClubPanelProps) {
  const baseId = useId()
  const [miembros, setMiembros] = useState<MiembroDirectivaCliente[]>([])
  const [lugarReunion, setLugarReunion] = useState('')
  const [diaReunion, setDiaReunion] = useState('')
  const [horarioReunion, setHorarioReunion] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [registrados, setRegistrados] = useState<MiembroClubCliente[]>([])
  const [cargandoRegistrados, setCargandoRegistrados] = useState(false)

  const cargar = useCallback(async () => {
    if (!clubId) {
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/directivas-club/${encodeURIComponent(clubId)}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        return
      }
      const data = (await res.json()) as { directiva?: DirectivaClubCliente | null }
      if (data.directiva) {
        const list = data.directiva.miembros.length > 0 ? data.directiva.miembros : [filaVacia(0)]
        setMiembros(list)
        setLugarReunion(data.directiva.lugarReunion)
        setDiaReunion(data.directiva.diaReunion)
        setHorarioReunion(data.directiva.horarioReunion)
      } else {
        setMiembros([filaVacia(0)])
        setLugarReunion('')
        setDiaReunion('')
        setHorarioReunion('')
      }
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!clubId) {
      setRegistrados([])
      return
    }
    setCargandoRegistrados(true)
    void fetchTodosMiembrosDelClub(clubId)
      .then(setRegistrados)
      .finally(() => setCargandoRegistrados(false))
  }, [clubId])

  function actualizarMiembro(index: number, campo: keyof MiembroDirectivaCliente, valor: string | null) {
    setMiembros((prev) => prev.map((m, i) => (i === index ? { ...m, [campo]: valor } : m)))
  }

  function alElegirMiembroRegistrado(index: number, miembroClubId: string) {
    if (!miembroClubId) {
      actualizarMiembro(index, 'miembroClubId', null)
      actualizarMiembro(index, 'nombreCompleto', '')
      actualizarMiembro(index, 'telefono', '')
      return
    }
    const m = registrados.find((x) => x.id === miembroClubId)
    if (!m) {
      setMensaje({ tipo: 'error', texto: MSG_MIEMBRO_NO_REGISTRADO })
      return
    }
    setMiembros((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              miembroClubId,
              nombreCompleto: `${m.nombre} ${m.apellidos}`.trim(),
              telefono: m.telefono ?? '',
            }
          : row,
      ),
    )
    setMensaje(null)
  }

  function agregarMiembro() {
    setMiembros((prev) => [...prev, filaVacia(prev.length)])
  }

  function quitarMiembro(index: number) {
    setMiembros((prev) => prev.filter((_, i) => i !== index))
  }

  async function guardar() {
    setMensaje(null)

    const aGuardar = miembros.filter((m) => m.nombreCompleto.trim() !== '')
    for (const m of aGuardar) {
      if (!m.miembroClubId) {
        setMensaje({ tipo: 'error', texto: MSG_MIEMBRO_NO_REGISTRADO })
        return
      }
    }

    if (registrados.length === 0 && aGuardar.length > 0) {
      setMensaje({
        tipo: 'error',
        texto:
          'No hay miembros registrados en este club. Agregue miembros en «Gestión de miembros de clubes» antes de armar la directiva.',
      })
      return
    }

    setGuardando(true)
    try {
      const res = await fetch(`/api/directivas-club/${encodeURIComponent(clubId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          miembros: aGuardar.map((m) => ({
            id: m.id,
            miembroClubId: m.miembroClubId!,
            cargo: m.cargo,
            nombreCompleto: m.nombreCompleto,
            telefono: m.telefono,
          })),
          lugarReunion,
          diaReunion,
          horarioReunion,
        }),
      })
      const errJson = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setMensaje({
          tipo: 'error',
          texto: errJson?.error ?? 'No se pudo guardar la directiva.',
        })
        return
      }
      setMensaje({ tipo: 'ok', texto: 'Directiva guardada correctamente.' })
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Cargando directiva…</p>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-800">Datos de reunión del club</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField
            fieldId={`${baseId}-lugar`}
            label="Lugar de reunión"
            value={lugarReunion}
            onChange={(ev) => setLugarReunion(ev.target.value)}
            maxLength={200}
            placeholder="Ej: Sede social Villa Los Aromos"
            disabled={!puedeGestionar}
            className="font-normal"
          />
          <TextField
            fieldId={`${baseId}-dia`}
            label="Día de reunión"
            value={diaReunion}
            onChange={(ev) => setDiaReunion(ev.target.value)}
            maxLength={100}
            placeholder="Ej: Martes"
            disabled={!puedeGestionar}
            className="font-normal"
          />
          <TextField
            fieldId={`${baseId}-horario`}
            label="Horario"
            value={horarioReunion}
            onChange={(ev) => setHorarioReunion(ev.target.value)}
            maxLength={100}
            placeholder="Ej: 10:00 - 12:00"
            disabled={!puedeGestionar}
            className="font-normal"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-800">Miembros de la directiva</h3>
        <p className="mt-1 text-sm text-slate-600">
          Solo puede asignar cargos a personas que ya figuren como{' '}
          <strong>miembros registrados de este club</strong> en el sistema. Si no aparece en la lista,
          créela primero en «Gestión de miembros de clubes».
        </p>
        {cargandoRegistrados ? (
          <p className="mt-2 text-xs text-slate-500">Cargando miembros del club…</p>
        ) : registrados.length === 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Este club aún no tiene miembros cargados. No puede armar la directiva hasta registrar
            al menos un miembro.
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          {miembros.map((m, i) => (
            <div
              key={m.id}
              className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-12"
            >
              <div className="flex flex-col gap-1 lg:col-span-3">
                <label className="text-xs font-medium text-slate-600" htmlFor={`${baseId}-cargo-${i}`}>
                  Cargo
                </label>
                <select
                  id={`${baseId}-cargo-${i}`}
                  value={m.cargo}
                  onChange={(ev) =>
                    actualizarMiembro(i, 'cargo', ev.target.value as CargoDirectiva)
                  }
                  disabled={!puedeGestionar}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                  {CARGOS_DIRECTIVA.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 lg:col-span-6">
                <label
                  className="text-xs font-medium text-slate-600"
                  htmlFor={`${baseId}-miembro-${i}`}
                >
                  Miembro registrado en el club
                </label>
                <select
                  id={`${baseId}-miembro-${i}`}
                  value={m.miembroClubId ?? ''}
                  onChange={(ev) => alElegirMiembroRegistrado(i, ev.target.value)}
                  disabled={!puedeGestionar || registrados.length === 0}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                  <option value="">— Seleccione un miembro —</option>
                  {registrados.map((mr) => (
                    <option key={mr.id} value={mr.id}>
                      {etiquetaMiembro(mr)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <TextField
                  fieldId={`${baseId}-dir-tel-${i}`}
                  label="Teléfono (directiva)"
                  value={m.telefono}
                  onChange={(ev) => actualizarMiembro(i, 'telefono', ev.target.value)}
                  maxLength={30}
                  disabled={!puedeGestionar}
                  className="font-normal text-sm"
                />
              </div>
              <div className="flex items-end lg:col-span-12">
                {puedeGestionar && miembros.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => quitarMiembro(i)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Quitar fila
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {puedeGestionar ? (
          <button
            type="button"
            onClick={agregarMiembro}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            + Agregar cargo
          </button>
        ) : null}
      </div>

      {mensaje ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === 'ok'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}

      {puedeGestionar ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={guardando || registrados.length === 0}
            onClick={() => void guardar()}
            className="rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar directiva'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
