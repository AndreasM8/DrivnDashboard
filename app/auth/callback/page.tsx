'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function AuthCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const code       = params.get('code')
      const token_hash = params.get('token_hash')
      const type       = params.get('type') as 'magiclink' | 'email' | 'signup' | 'recovery' | null

      // ── Implicit flow: tokens in URL hash ──────────────────────────────────
      const hash        = window.location.hash.substring(1)
      const hashParams  = new URLSearchParams(hash)
      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        if (error) { setErrorMsg(`setSession: ${error.message}`); return }

      } else if (code) {
        // ── PKCE flow: authorization code in query params ────────────────────
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setErrorMsg(`exchangeCode: ${error.message}`); return }

      } else if (token_hash && type) {
        // ── OTP flow: token_hash in query params ─────────────────────────────
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) { setErrorMsg(`verifyOtp: ${error.message}`); return }

      } else {
        setErrorMsg(`No auth params found. hash="${hash}" code="${code}" token_hash="${token_hash}"`)
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

    handle()
  }, [params, router])

  if (errorMsg) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: 24,
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 12 }}>Auth error (share this with support):</p>
          <pre style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {errorMsg}
          </pre>
          <button
            onClick={() => router.replace('/auth/login')}
            style={{ marginTop: 16, fontSize: 14, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <p style={{ fontSize: '15px', color: 'var(--text-2)' }}>Signing you in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <p style={{ fontSize: '15px', color: 'var(--text-2)' }}>Signing you in…</p>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
