'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkspaceSummary, TeamRole } from '@/types'

interface Props {
  workspaces: WorkspaceSummary[]
}

function roleLabel(role: TeamRole) {
  return role === 'setter' ? 'Setter' : role === 'closer' ? 'Closer' : 'Setter + Closer'
}

export default function WorkspaceSwitcher({ workspaces }: Props) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const router = useRouter()

  const active = workspaces.find(w => w.isActive) ?? workspaces[0]

  async function switchTo(memberId: string) {
    if (switching || memberId === active.memberId) { setOpen(false); return }
    setSwitching(true)
    setOpen(false)
    await fetch('/api/team/switch-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    // Full reload so the server layout re-runs with the new cookie
    window.location.href = '/team-dashboard'
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          background: open ? 'var(--surface-2)' : 'transparent',
          border: '1px solid',
          borderColor: open ? 'var(--border-strong)' : 'var(--border)',
          borderRadius: 8,
          cursor: switching ? 'wait' : 'pointer',
          transition: 'background 120ms ease, border-color 120ms ease',
          textAlign: 'left',
          opacity: switching ? 0.6 : 1,
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(99,102,241,0.15)',
          color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {active.coachName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {active.coachName}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>
            {roleLabel(active.role)}
          </p>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            flexShrink: 0, opacity: 0.4, color: 'var(--text-2)',
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0, right: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: 'var(--shadow-dropdown)',
          }}>
            {workspaces.map(ws => (
              <button
                key={ws.memberId}
                onClick={() => switchTo(ws.memberId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  background: ws.isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                  border: 'none',
                  cursor: ws.isActive ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={e => {
                  if (!ws.isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)'
                }}
                onMouseLeave={e => {
                  if (!ws.isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: ws.isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                  color: ws.isActive ? 'var(--accent)' : 'var(--text-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {ws.coachName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 12,
                    fontWeight: ws.isActive ? 600 : 400,
                    color: ws.isActive ? 'var(--text-1)' : 'var(--text-2)',
                    margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ws.coachName}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>
                    {roleLabel(ws.role)}
                  </p>
                </div>
                {ws.isActive && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: 'var(--accent)' }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
