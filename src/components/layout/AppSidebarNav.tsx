// Navegación lateral por secciones (estilo referencia: franja lima, iconos en recuadro).

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@/constants'
import {
  IconBuilding,
  IconCalendar,
  IconGridFour,
  IconSearch,
  IconUser,
  IconUserPlus,
  IconUsersTwo,
} from '@/components/layout/icons/NavIcons'

type Item = {
  href: string
  label: string
  Icon: typeof IconGridFour
}

type Section = {
  title: string
  items: Item[]
}

const SECTIONS_SUPERIOR: Section[] = [
  {
    title: 'General',
    items: [{ href: ROUTES.dashboard, label: 'Panel de Control', Icon: IconGridFour }],
  },
]

const SECTIONS_ADMINISTRACION: Section[] = [
  {
    title: 'Administración',
    items: [
      { href: ROUTES.adminClubes, label: 'Gestión de clubes', Icon: IconBuilding },
      {
        href: ROUTES.adminMiembrosClubes,
        label: 'Gestión de miembros de clubes',
        Icon: IconUsersTwo,
      },
      {
        href: ROUTES.adminMiembrosBusqueda,
        label: 'Búsqueda de miembros',
        Icon: IconSearch,
      },
      {
        href: ROUTES.adminDirectivas,
        label: 'Gestión de directivas CAM',
        Icon: IconCalendar,
      },
    ],
  },
]

const SECTIONS_INFERIOR: Section[] = [
  {
    title: 'Usuarios',
    items: [
      { href: ROUTES.screenTwo, label: 'Usuarios', Icon: IconUser },
      { href: ROUTES.screenThree, label: 'Nuevo Usuario', Icon: IconUserPlus },
    ],
  },
]

function SectionBlock({
  sections,
  firstHeadingNoTopMargin,
  onItemClick,
}: {
  sections: Section[]
  firstHeadingNoTopMargin?: boolean
  onItemClick?: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      {sections.map((section, index) => (
        <div key={section.title}>
          <h3
            className={`mb-2 mt-5 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500 ${
              firstHeadingNoTopMargin && index === 0 ? 'mt-0' : ''
            }`}
          >
            {section.title}
          </h3>
          <ul className="flex flex-col gap-2.5">
            {section.items.map(({ href, label, Icon }) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => onItemClick?.()}
                    className={`flex items-center gap-3.5 rounded-lg py-3 pl-2.5 pr-3.5 text-[0.9375rem] font-semibold leading-snug transition ${
                      active
                        ? 'border-l-[0.1875rem] border-lime-400 bg-blue-800 text-white shadow-sm'
                        : 'border-l-[0.1875rem] border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded-md p-2 ${
                        active ? 'bg-blue-700' : 'bg-slate-200/90 text-slate-600'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${active ? 'text-white' : 'text-slate-600'}`} />
                    </span>
                    <span className="min-w-0">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

export interface AppSidebarNavProps {
  onItemClick?: () => void
}

export function AppSidebarNav({ onItemClick }: AppSidebarNavProps) {
  return (
    <nav
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Menú principal"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <SectionBlock
          sections={SECTIONS_SUPERIOR}
          firstHeadingNoTopMargin
          onItemClick={onItemClick}
        />
        <div className="mt-8 border-t border-slate-200/70 pt-6">
          <SectionBlock
            sections={SECTIONS_ADMINISTRACION}
            firstHeadingNoTopMargin
            onItemClick={onItemClick}
          />
        </div>
      </div>
      <div className="mt-2 shrink-0 px-3 pb-2 pt-2">
        <SectionBlock
          sections={SECTIONS_INFERIOR}
          firstHeadingNoTopMargin
          onItemClick={onItemClick}
        />
      </div>
    </nav>
  )
}
