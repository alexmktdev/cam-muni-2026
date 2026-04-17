'use client'

import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query'

/**
 * Envuelve `children` con `HydrationBoundary` para que TanStack Query reciba
 * los datos pre-cargados desde el servidor (p. ej. catálogo de clubes).
 */
export function HydrateClubesCatalogo({
  state,
  children,
}: {
  state: DehydratedState
  children: React.ReactNode
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>
}
