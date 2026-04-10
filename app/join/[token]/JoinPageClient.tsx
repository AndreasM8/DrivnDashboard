'use client'

import { useState } from 'react'

interface Props {
  token: string
  memberName: string
  memberEmail: string
  role: 'setter' | 'closer'
  coachName: string
}

export default function JoinPageClient({ token, memberName, memberEmail, role, coachName }: Props) {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/team/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      setSent(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0F172A',
      padding: 24,
    }}>
      <div style={{
        background: '#1E293B',
        borderRadius: 20,
        padding: 40,
        width: '100%',
        maxWidth: 420,
        border: '1px solid #334155',
        textAlign: 'center',
      }}>
        {/* Logo / brand */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            borderRadius: 16,
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            ⚡
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748B', textTransform: 'uppercase', margin: 0 }}>
            Drivn
          </p>
        </div>

        {sent ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' }}>
              Check your email
            </h1>
            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
              We sent a login link to <strong style={{ color: '#CBD5E1' }}>{memberEmail}</strong>. Click it to access your dashboard.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' }}>
              You&apos;ve been invited
            </h1>
            <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 28, lineHeight: 1.6 }}>
              <strong style={{ color: '#CBD5E1' }}>{coachName}</strong> has added you to their team as a{' '}
              <span style={{
                fontWeight: 700,
                color: role === 'setter' ? '#7C3AED' : '#2563EB',
                background: role === 'setter' ? 'rgba(124,58,237,0.12)' : 'rgba(37,99,235,0.12)',
                padding: '2px 8px',
                borderRadius: 6,
              }}>
                {role === 'setter' ? 'Setter' : 'Closer'}
              </span>
            </p>

            <div style={{
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Joining as</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>{memberName}</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{memberEmail}</div>
            </div>

            {error && (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FCA5A5' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: loading ? '#1E40AF' : '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 120ms',
              }}
            >
              {loading ? 'Sending login link…' : 'Accept invite & get login link'}
            </button>

            <p style={{ fontSize: 12, color: '#475569', marginTop: 16 }}>
              We&apos;ll send a magic link to {memberEmail}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
