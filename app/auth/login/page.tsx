'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (authError) {
      setError(authError.message)
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    if (authError) {
      setError('Invalid or expired code. Try requesting a new one.')
      setLoading(false)
      return
    }
    // Check onboarding
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()
      if (!profile?.onboarding_complete) {
        router.replace('/onboarding')
        return
      }
    }
    router.replace('/dashboard')
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
                We'll send a 6-digit code to your email.
              </p>
              <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  {loading ? 'Sending…' : 'Send code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Check your email</h2>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
                We sent a 6-digit code to <strong style={{ color: 'var(--text-1)' }}>{email}</strong>
              </p>
              <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
                    Enter code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="········"
                    className="input-base"
                    style={{ width: '100%', fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
                    autoFocus
                  />
                </div>
                {error && (
                  <p style={{ fontSize: 13, color: 'var(--danger)', background: 'rgba(220,38,38,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || code.length < 4}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {loading ? 'Verifying…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  style={{ fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                >
                  ← Use a different email
                </button>
              </form>
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
