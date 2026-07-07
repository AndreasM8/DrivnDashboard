'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { TeamMember } from '@/types'

interface TabItem {
  href: string
  label: string
  icon: React.ReactNode
}

function Tab({ href, label, icon }: TabItem) {
  const pathname = usePathname()
  // Root tab (/team-dashboard) should only be active on exact match, not on sub-pages
  const active = href === '/team-dashboard'
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '8px 12px',
        flex: 1,
        minWidth: 0,
        textDecoration: 'none',
        color: active ? 'var(--accent)' : 'var(--text-3)',
        transition: 'color 120ms ease',
        fontSize: '13px',
        fontWeight: '500',
      }}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: active ? 1 : 0.5,
          transition: 'opacity 120ms ease',
        }}
      >
        {icon}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {label}
      </span>
    </Link>
  )
}

interface Props {
  member: TeamMember
}

export default function TeamBottomNav({ member: _member }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid var(--border)',
        zIndex: 50,
        height: '60px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        alignItems: 'stretch',
      }}
      className="flex md:hidden"
    >
      <Tab href="/team-dashboard" label="Overview" icon={<HomeIcon />} />
      <Tab href="/team-dashboard/non-negotiables" label="Non-neg" icon={<CheckCircleIcon />} />
      <Tab href="/team-dashboard/my-tasks" label="Tasks" icon={<ClipboardIcon />} />
      <Tab href="/team-dashboard/performance" label="Stats" icon={<ChartBarIcon />} />
      <Tab href="/team-dashboard/settings" label="Settings" icon={<SettingsIcon />} />
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )
}
