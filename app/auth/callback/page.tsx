'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// This page handles both PKCE magic links (code param) and OTP magic links (token_hash param).
// It must be a client component so it has access to localStorage where
// Supabase stores the PKCE code verifier between the sign-in request and callback.

export default function AuthCallbackPage() {
  const router   = useRouter()
  const params   = useSearchParams()

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const code       = params.get('code')
      const token_hash = params.get('token_hash')
      const type       = params.get('type') as 'magiclink' | 'email' | 'signup' | 'recovery' | null

      let error = null

      if (code) {
        // PKCE flow — browser client picks up code_verifier from localStorage
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
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '15px', color: 'var(--text-2)' }}>Signing you in…</p>
      </div>
    </div>
  )
}
