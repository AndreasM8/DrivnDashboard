import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { EmailOtpType } from '@supabase/supabase-js'

async function redirectAfterAuth(origin: string, supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()
    if (!profile?.onboarding_complete) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null

  const supabase = await createServerSupabaseClient()

  // PKCE flow (OAuth / some magic link configs)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectAfterAuth(origin, supabase)
  }

  // OTP / magic-link flow (token_hash + type)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) return redirectAfterAuth(origin, supabase)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
