// Shell con sidebar deslizable en móvil y barra superior para abrir el menú.

'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { MARCA_APP } from '@/constants'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { IconMenu } from '@/components/layout/icons/NavIcons'
import { NavigationProgress } from '@/components/layout/NavigationProgress'

export interface ResponsiveAppShellProps {
  children: ReactNode
  nombreUsuario: string
  inicialesUsuario: string
  rolUsuario?: string
}

export function ResponsiveAppShell({
  children,
  nombreUsuario,
  inicialesUsuario,
  rolUsuario,
}: ResponsiveAppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const cerrar = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cerrar()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cerrar])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    function onChange() {
      if (mq.matches) {
        cerrar()
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [cerrar])

  useEffect(() => {
    if (mobileOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
    return undefined
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-slate-100">
      <NavigationProgress />
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
          aria-expanded={mobileOpen}
          aria-controls="sidebar-principal"
        >
          <IconMenu className="h-6 w-6" aria-hidden />
          <span className="sr-only">Abrir menú</span>
        </button>
        <span className="truncate text-base font-bold text-blue-900">{MARCA_APP}</span>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          aria-label="Cerrar menú"
          onClick={cerrar}
        />
      ) : null}

      <AppSidebar
        id="sidebar-principal"
        nombreUsuario={nombreUsuario}
        inicialesUsuario={inicialesUsuario}
        rolUsuario={rolUsuario}
        mobileOpen={mobileOpen}
        onNavigate={cerrar}
      />

      <div className="min-h-screen pt-14 lg:pl-72 lg:pt-0">{children}</div>
    </div>
  )
}
