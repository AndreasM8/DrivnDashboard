'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CoachRow {
  id: string
  name: string
  businessName: string
  currency: string
  activeClients: number
  lastLogin: string | null
}

interface Props {
  coaches: CoachRow[]
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AdminClient({ coaches }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleViewAs(coach: CoachRow) {
    setLoadingId(coach.id)
    const res = await fetch('/api/admin/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: coach.id, coachName: coach.name }),
    })
    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setLoadingId(null)
      alert('Failed to switch view')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-1)', marginBottom: '4px' }}>
          Admin — All Coaches
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          {coaches.length} coach{coaches.length !== 1 ? 'es' : ''} registered
        </p>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>

        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 80px 100px 100px',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}>
          {['Coach', 'Business', 'Clients', 'Last login', ''].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {h}
            </span>
          ))}
        </div>

        {coaches.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: '13px' }}>
            No coaches yet. Coaches appear here when they sign up.
          </div>
        ) : (
          coaches.map((coach, i) => (
            <div
              key={coach.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 80px 100px 100px',
                padding: '14px 16px',
                alignItems: 'center',
                borderBottom: i < coaches.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* Name */}
              <div>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{coach.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px' }}>{coach.currency}</p>
              </div>

              {/* Business */}
              <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>{coach.businessName || '—'}</p>

              {/* Clients */}
              <p style={{ fontSize: '13px', fontWeight: '600', color: coach.activeClients > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                {coach.activeClients}
              </p>

              {/* Last login */}
              <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>{timeAgo(coach.lastLogin)}</p>

              {/* View as button */}
              <button
                onClick={() => handleViewAs(coach)}
                disabled={loadingId === coach.id}
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  cursor: loadingId === coach.id ? 'not-allowed' : 'pointer',
                  opacity: loadingId === coach.id ? 0.5 : 1,
                  transition: 'all 120ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (loadingId !== coach.id) {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(37,99,235,0.1)'
                    el.style.color = 'var(--accent)'
                    el.style.borderColor = 'rgba(37,99,235,0.3)'
                  }
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'transparent'
                  el.style.color = 'var(--text-2)'
                  el.style.borderColor = 'var(--border-strong)'
                }}
              >
                {loadingId === coach.id ? 'Loading…' : 'View as →'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
