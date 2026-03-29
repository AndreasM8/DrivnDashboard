import { NextRequest, NextResponse } from 'next/server'
import { getOAuthClient } from '@/lib/google-sheets'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL}/settings?section=integrations`

  if (error || !code) {
    return NextResponse.redirect(`${redirectBase}&google=error`)
  }

  try {
    const oauth2 = getOAuthClient()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${redirectBase}&google=error`)
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/login`)
    }

    await supabase.from('google_integrations').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
    })

    return NextResponse.redirect(`${redirectBase}&google=connected`)
  } catch {
    return NextResponse.redirect(`${redirectBase}&google=error`)
  }
}
