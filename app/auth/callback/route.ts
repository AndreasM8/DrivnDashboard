import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null

  // Build the redirect first — cookies will be set directly on this response
  let redirectUrl = `${origin}/dashboard`
  const response  = NextResponse.redirect(redirectUrl)

  // Create a Supabase client that reads cookies from the request
  // and writes them directly onto the response (not next/headers)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // PKCE flow (OAuth / some magic link configs)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }
  // OTP / magic-link flow (token_hash + type)
  else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }
  else {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
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
      const onboardingResponse = NextResponse.redirect(`${origin}/onboarding`)
      // Copy auth cookies onto the new response
      response.cookies.getAll().forEach(cookie =>
        onboardingResponse.cookies.set(cookie.name, cookie.value)
      )
      return onboardingResponse
    }
  }

  return response
}
