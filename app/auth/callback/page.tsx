'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function AuthCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const code       = params.get('code')
      const token_hash = params.get('token_hash')
      const type       = params.get('type') as 'magiclink' | 'email' | 'signup' | 'recovery' | null

      let error = null

      if (code) {
        // PKCE flow — browser client reads code_verifier from localStorage
        const result = await supabase.auth.exchangeCodeForSession(code)
        error = result.error
      } else if (token_hash && type) {
        // OTP / implicit magic link flow
        const result = await supabase.auth.verifyOtp({ token_hash, type })
        error = result.error
      } else {
        router.replace('/auth/login?error=auth_failed')
        return
      }

      if (error) {
        router.replace('/auth/login?error=auth_failed')
        return
      }

      // Check onboarding status
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
