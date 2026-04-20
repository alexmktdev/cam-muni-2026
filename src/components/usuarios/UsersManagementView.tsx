// Vista de gestión de usuarios: búsqueda en cliente sobre datos ya cargados en servidor.

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { QUERY_KEY_SHELL_PERFIL } from '@/lib/query/shellProfileQueryKey'
import type { UsuarioListaCliente } from '@/types/user.types'
import { IconMail, IconPencil, IconSearch, IconTrash } from '@/components/layout/icons/NavIcons'
import { UserDeleteConfirmModal } from '@/components/usuarios/UserDeleteConfirmModal'
import { UserEditModal } from '@/components/usuarios/UserEditModal'

export interface UsersManagementViewProps {
  initialUsers: UsuarioListaCliente[]
  puedeGestionar: boolean
  miUsuarioId: string
}

function clasesBadgeRol(role: string): string {
  const r = role.toLowerCase().replace(/\s+/g, '')
  if (r.includes('superadmin')) {
    return 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200'
  }
  if (r.includes('director')) {
    return 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200'
  }
  if (r.includes('supervisor')) {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200'
  }
  if (r.includes('municipal')) {
    return 'bg-yellow-100 text-yellow-900 ring-1 ring-inset ring-yellow-200'
  }
  return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
}

function MiniUserPlus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function MiniUserMinus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

export function UsersManagementView({
  initialUsers,
  puedeGestionar,
  miUsuarioId,
}: UsersManagementViewProps) {
  const queryClient = useQueryClient()
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editando, setEditando] = useState<UsuarioListaCliente | null>(null)
  const [eliminarA, setEliminarA] = useState<UsuarioListaCliente | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return users
    }
    return users.filter((u) => {
      const blob = `${u.nombre} ${u.email} ${u.role}`.toLowerCase()
      return blob.includes(q)
    })
  }, [users, query])

  async function setUserActive(id: string, active: boolean) {
    setPendingId(id)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
        credentials: 'include',
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null
        window.alert(err?.error ?? 'No se pudo actualizar el usuario')
        return
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)))
      if (id === miUsuarioId) {
        void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_SHELL_PERFIL] })
      }
    } finally {
      setPendingId(null)
    }
  }

  function abrirEliminar(u: UsuarioListaCliente) {
    if (u.id === miUsuarioId) {
      return
    }
    setErrorEliminar(null)
    setEliminarA(u)
  }

  async function confirmarEliminar() {
    const u = eliminarA
    if (!u || u.id === miUsuarioId) {
      return
    }
    setPendingId(u.id)
    setErrorEliminar(null)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null
        setErrorEliminar(err?.error ?? 'No se pudo eliminar el usuario')
        return
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      setEliminarA(null)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col">
      {editando ? (
        <UserEditModal
          user={editando}
          miUsuarioId={miUsuarioId}
          onClose={() => setEditando(null)}
          onGuardado={(actualizado) => {
            setUsers((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)))
            if (actualizado.id === miUsuarioId) {
              void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_SHELL_PERFIL] })
            }
          }}
        />
      ) : null}

      <UserDeleteConfirmModal
        user={eliminarA}
        error={errorEliminar}
        loading={eliminarA != null && pendingId === eliminarA.id}
        onClose={() => {
          setEliminarA(null)
          setErrorEliminar(null)
        }}
        onConfirm={() => void confirmarEliminar()}
      />

      <div className="relative mb-6">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, apellido, email o rol..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
          aria-label="Buscar usuarios"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            Listado de Usuarios ({filtered.length})
          </h2>
        </div>

        {users.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No hay usuarios en la colección.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Usuario</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Rol</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => {
                    const busy = pendingId === u.id
                    const esYo = u.id === miUsuarioId
                    return (
                      <tr key={u.id} className="text-slate-800">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-800 text-xs font-bold text-white">
                              {u.iniciales}
                            </div>
                            <span className="font-bold text-slate-900">{u.nombre}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 text-slate-600">
                            <IconMail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="break-all">{u.email}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${clasesBadgeRol(u.role)}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {u.active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-200">
                              <MiniUserPlus className="h-3.5 w-3.5" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200">
                              <MiniUserMinus className="h-3.5 w-3.5" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {puedeGestionar ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setEditando(u)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <IconPencil className="h-4 w-4" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || esYo}
                                  onClick={() => abrirEliminar(u)}
                                  title={esYo ? 'No puede eliminar su propia cuenta' : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <IconTrash className="h-4 w-4" />
                                  Eliminar
                                </button>
                                {u.active ? (
                                  <button
                                    type="button"
                                    disabled={busy || esYo}
                                    onClick={() => void setUserActive(u.id, false)}
                                    title={esYo ? 'No puede desactivarse a sí mismo' : undefined}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <MiniUserMinus className="h-4 w-4" />
                                    Desactivar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void setUserActive(u.id, true)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                                  >
                                    <MiniUserPlus className="h-4 w-4" />
                                    Activar
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No hay usuarios que coincidan con la búsqueda.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
