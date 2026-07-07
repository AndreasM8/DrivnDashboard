'use client'

import { createClient } from '@/lib/supabase'
import { useDarkMode } from '@/components/providers/DarkModeProvider'
import WorkspaceSwitcher from '@/components/team/WorkspaceSwitcher'
import type { TeamMember, WorkspaceSummary } from '@/types'

const CARD: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 20,
}

interface Props {
  member: TeamMember
  workspaces?: WorkspaceSummary[]
}

export default function TeamSettingsClient({ member, workspaces = [] }: Props) {
  const { dark, toggle } = useDarkMode()
  const roleColor = member.role === 'setter' ? '#7C3AED' : member.role === 'closer' ? '#2563EB' : '#059669'
  const roleBg = member.role === 'setter' ? 'rgba(124,58,237,0.12)' : member.role === 'closer' ? 'rgba(37,99,235,0.12)' : 'rgba(5,150,105,0.12)'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Account and preferences
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Account card */}
        <div style={CARD}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Account
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: roleBg, color: roleColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, flexShrink: 0,
            }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
                {member.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
                  {member.email}
                </p>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: roleColor, background: roleBg, padding: '1px 6px', borderRadius: 4,
                }}>
                  {member.role === 'setter' ? 'Setter' : member.role === 'closer' ? 'Closer' : 'Setter + Closer'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace switcher — mobile only (desktop uses sidebar) */}
        {workspaces.length > 1 && (
          <div style={CARD}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Switch Workspace
            </p>
            <WorkspaceSwitcher workspaces={workspaces} />
          </div>
        )}

        {/* Appearance card */}
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
              Appearance
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
              {dark ? 'Dark mode is on' : 'Light mode is on'}
            </p>
          </div>
          <button
            onClick={toggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
              color: 'var(--text-1)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', flexShrink: 0,
              transition: 'background 120ms ease',
            }}
          >
            {dark ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Light mode
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                Dark mode
              </>
            )}
          </button>
        </div>

        {/* Sign out */}
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
              Sign out
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
              Log out of your Drivn account
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--danger)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', flexShrink: 0,
              transition: 'background 120ms ease',
            }}
          >
            Log out
          </button>
        </div>

      </div>
    </div>
  )
}
