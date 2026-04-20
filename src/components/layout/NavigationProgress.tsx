'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Barra fina de progreso en la parte superior de la pantalla.
 * Se activa al hacer clic en un enlace interno y desaparece
 * cuando la navegación completa (pathname cambia).
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)
  const prevPathname = useRef(pathname)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setNavigating(false)
    }
  }, [pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#') || href === pathname) return

      clearTimeout(timeoutRef.current)
      setNavigating(true)

      timeoutRef.current = setTimeout(() => setNavigating(false), 8000)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      clearTimeout(timeoutRef.current)
    }
  }, [pathname])

  if (!navigating) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-blue-100">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-lime-400"
        style={{
          animation: 'nav-progress 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      />
      <style>{`
        @keyframes nav-progress {
          0%   { width: 0% }
          20%  { width: 30% }
          50%  { width: 60% }
          80%  { width: 85% }
          100% { width: 95% }
        }
      `}</style>
    </div>
  )
}
