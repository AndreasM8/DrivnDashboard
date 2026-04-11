'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { TeamMember } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/team-dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 12px',
        borderRadius: '7px',
        fontSize: '13px',
        fontWeight: active ? '500' : '400',
        color: active ? 'var(--text-1)' : 'var(--text-2)',
        background: active ? 'var(--surface-2)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 120ms ease, color 120ms ease',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
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
      {active && (
        <span style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: '2px', background: 'var(--accent)', borderRadius: '0 2px 2px 0',
        }} />
      )}
      <span style={{
        width: '16px', height: '16px', flexShrink: 0,
        opacity: active ? 1 : 0.45,
        color: active ? 'var(--accent)' : 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 120ms ease, color 120ms ease',
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  )
}

interface TeamSidebarProps {
  member: TeamMember
}

export default function TeamSidebar({ member }: TeamSidebarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const roleColor = member.role === 'setter' ? '#7C3AED' : '#2563EB'
  const roleBg = member.role === 'setter' ? 'rgba(124,58,237,0.12)' : 'rgba(37,99,235,0.12)'

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
      <div style={{
        height: '52px',
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="1" width="9" height="9" rx="2.5" fill="var(--accent)" />
          <rect x="12" y="1" width="9" height="9" rx="2.5" fill="var(--accent)" opacity="0.4" />
          <rect x="1" y="12" width="9" height="9" rx="2.5" fill="var(--accent)" opacity="0.4" />
          <rect x="12" y="12" width="9" height="9" rx="2.5" fill="var(--accent)" opacity="0.2" />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Drivn
        </span>
      </div>

      {/* Member identity */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: roleBg,
          color: roleColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: roleColor, background: roleBg, padding: '1px 6px', borderRadius: 4,
          }}>
            {member.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, padding: '12px 10px',
        display: 'flex', flexDirection: 'column', gap: '1px',
        overflowY: 'auto',
      }}>
        <NavLink href="/team-dashboard" label="Overview" icon={<HomeIcon />} />
        <NavLink href="/team-dashboard/non-negotiables" label="Non-negotiables" icon={<CheckIcon />} />
        <NavLink href="/team-dashboard/my-tasks" label="My Tasks" icon={<TaskIcon />} />
        <NavLink href="/team-dashboard/team-tasks" label="Team Tasks" icon={<TeamIcon />} />
        <NavLink href="/team-dashboard/performance" label="Performance" icon={<ChartIcon />} />

        {member.permissions.pipeline && (
          <>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 2px' }} />
            <NavLink href="/pipeline" label="Pipeline" icon={<PipelineIcon />} />
          </>
        )}
        {member.permissions.clients && (
          <NavLink href="/team-dashboard/clients" label="Clients" icon={<ClientsIcon />} />
        )}
      </nav>

      {/* Bottom: Logout */}
      <div style={{
        padding: '8px 10px 12px',
        borderTop: '1px solid var(--border)',
        opacity: 0.75,
      }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '7px 12px', borderRadius: '7px',
            fontSize: '13px', fontWeight: '400',
            color: 'var(--text-2)', background: 'transparent',
            border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
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

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
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

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.707 4.293a1 1 0 010 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M13 10a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  )
}
