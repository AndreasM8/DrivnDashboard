'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useT } from '@/contexts/LanguageContext'
import LogoMark from '@/components/ui/LogoMark'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
  walkthroughId?: string
}

function NavLink({ href, label, icon, badge, walkthroughId }: NavItem) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      {...(walkthroughId ? { 'data-walkthrough': walkthroughId } : {})}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: active ? '7px 12px 7px 10px' : '7px 12px',
        borderRadius: '7px',
        fontSize: '13px',
        fontWeight: active ? '500' : '400',
        color: active ? 'var(--text-1)' : 'var(--text-2)',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        borderLeft: active ? '2px solid var(--neon-indigo)' : '2px solid transparent',
        textDecoration: 'none',
        transition: 'background 120ms ease, color 120ms ease',
        overflow: 'hidden',
        animation: active ? 'pulse-glow 3s ease-in-out infinite' : undefined,
      }}
      onMouseEnter={e => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-1)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
        }
      }}
    >
      {/* Icon */}
      <span
        style={{
          width: '16px',
          height: '16px',
          flexShrink: 0,
          opacity: active ? 1 : 0.45,
          color: active ? 'var(--neon-indigo)' : 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 120ms ease, color 120ms ease',
        }}
      >
        {icon}
      </span>

      <span style={{ flex: 1 }}>{label}</span>

      {badge != null && badge > 0 && (
        <span
          style={{
            background: 'var(--neon-red)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 10,
            marginLeft: 'auto',
            boxShadow: 'var(--glow-red)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

interface SidebarProps {
  taskBadge?: number
  isOwner?: boolean
  isAdmin?: boolean
  showTeam?: boolean
}

export default function Sidebar({ taskBadge = 0, isOwner = true, isAdmin = false, showTeam = false }: SidebarProps) {
  const router = useRouter()
  const t = useT()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      style={{
        display: 'none',
        flexDirection: 'column',
        width: '220px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        height: '100%',
        flexShrink: 0,
      }}
      className="md:flex"
    >
      {/* Logo */}
      <div
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <LogoMark height={52} maxWidth={200} />
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          overflowY: 'auto',
        }}
      >
        <NavLink href="/dashboard" label={t.nav.dashboard} icon={<HomeIcon />} />
        <NavLink href="/tasks" label={t.nav.tasks} icon={<TasksIcon />} badge={taskBadge} walkthroughId="nav-tasks" />

        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 2px' }} />

        <NavLink href="/pipeline" label={t.nav.pipeline} icon={<PipelineIcon />} walkthroughId="nav-pipeline" />
        <NavLink href="/clients" label={t.nav.clients} icon={<ClientsIcon />} walkthroughId="nav-clients" />
        <NavLink href="/upsells" label={t.nav.upsells} icon={<UpsellsIcon />} />
        <NavLink href="/checkins" label={t.nav.checkins} icon={<CheckinsIcon />} walkthroughId="nav-checkins" />

        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 2px' }} />

        <NavLink href="/numbers" label={t.nav.numbers} icon={<NumbersIcon />} walkthroughId="nav-numbers" />
        <NavLink href="/ask" label={t.nav.ask} icon={<AskIcon />} walkthroughId="nav-ask" />

        {(showTeam || isAdmin) && (
          <NavLink href="/team" label={t.nav.team} icon={<TeamIcon />} />
        )}

        {isAdmin && (
          <>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 2px' }} />
            <NavLink href="/admin" label={t.nav.admin} icon={<AdminIcon />} />
          </>
        )}

      </nav>

      {/* Bottom: Settings + Logout */}
      <div
        style={{
          padding: '8px 10px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          opacity: 0.75,
        }}
      >
        {isOwner && (
          <NavLink href="/settings" label={t.nav.settings} icon={<SettingsIcon />} />
        )}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '7px 12px',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: '400',
            color: 'var(--text-2)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
          }}
        >
          <span style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0.45, display: 'flex', alignItems: 'center' }}>
            <LogoutIcon />
          </span>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
    </svg>
  )
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

function UpsellsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M10 1l2.39 4.845L18 6.882l-4 3.899.944 5.504L10 13.77l-4.944 2.515L6 10.78 2 6.882l5.61-1.037L10 1z" clipRule="evenodd" />
    </svg>
  )
}

function NumbersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}

function CheckinsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-3a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4zM8.5 6a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5H9a.5.5 0 01-.5-.5V6z" clipRule="evenodd" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.707 4.293a1 1 0 010 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M13 10a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  )
}

function AskIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
    </svg>
  )
}
