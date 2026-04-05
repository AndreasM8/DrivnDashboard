'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [step,    setStep]    = useState<'email' | 'sent'>('email')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.')
    } else {
      setStep('sent')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Drivn</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Your coaching business, in one place</p>
        </div>

        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: 28,
        }}>
          {step === 'email' ? (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Sign in</h2>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
                We&apos;ll send you a sign-in link. No password needed.
              </p>
              <form onSubmit={sendLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-base"
                    style={{ width: '100%' }}
                  />
                </div>
                {error && (
                  <p style={{ fontSize: 13, color: 'var(--danger)', background: 'rgba(220,38,38,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {loading ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Check your email</h2>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
                We sent a sign-in link to <strong style={{ color: 'var(--text-1)' }}>{email}</strong>. Click it to sign in — the link expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={() => { setStep('email'); setError('') }}
                style={{ fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', width: '100%' }}
              >
                ← Use a different email
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 20 }}>
          Built for online fitness coaches
        </p>
      </div>
    </div>
  )
}
