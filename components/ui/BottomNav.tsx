'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface TabItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

function Tab({ href, label, icon, badge }: TabItem) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 px-3 py-2 flex-1 min-w-0 transition-colors ${
        active ? 'text-blue-600' : 'text-gray-400'
      }`}
    >
      <span className="relative w-6 h-6">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium truncate">{label}</span>
    </Link>
  )
}

interface BottomNavProps {
  taskBadge?: number
  isOwner?: boolean
}

export default function BottomNav({ taskBadge = 0, isOwner = false }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50 safe-area-bottom">
      <Tab href="/dashboard" label="Home" icon={<HomeIcon />} />
      <Tab href="/tasks" label="Tasks" icon={<TasksIcon />} badge={taskBadge} />
      <Tab href="/pipeline" label="Pipeline" icon={<PipelineIcon />} />
      <Tab href="/clients" label="Clients" icon={<ClientsIcon />} />
      <Tab href="/numbers" label="Numbers" icon={<NumbersIcon />} />
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
    </svg>
  )
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

function NumbersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  )
}
