'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function VerifyInner() {
  const params   = useSearchParams()
  const router   = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [msg,    setMsg]    = useState('')

  useEffect(() => {
    const tokenHash = params.get('token_hash')
    const type      = (params.get('type') ?? 'magiclink') as 'magiclink' | 'email'

    if (!tokenHash) {
      setMsg('Invalid or missing link. Please request a new one.')
      setStatus('error')
      return
    }

    const supabase = createClient()
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(async ({ error }) => {
      if (error) {
        setMsg('This link has expired or already been used. Please request a new one.')
        setStatus('error')
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
    })
  }, [params, router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '32px 28px',
        width: '100%',
        maxWidth: 360,
        textAlign: 'center',
      }}>
        {status === 'loading' ? (
          <>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
              Signing you in…
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Hold tight, just a second.</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)', marginBottom: 16 }}>{msg}</p>
            <a
              href="/auth/login"
              style={{
                display: 'inline-block',
                background: 'var(--accent)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  )
}
