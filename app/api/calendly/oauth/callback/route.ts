import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const redirectBase = `${appUrl}/settings?section=integrations`
  const redirectUri = `${appUrl}/api/calendly/oauth/callback`

  if (error || !code) {
    return NextResponse.redirect(`${redirectBase}&calendly=error`)
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CALENDLY_CLIENT_ID ?? '',
        client_secret: process.env.CALENDLY_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        code,
      }).toString(),
    })

    if (!tokenRes.ok) {
      console.error('[calendly oauth] Token exchange failed', await tokenRes.text())
      return NextResponse.redirect(`${redirectBase}&calendly=error`)
    }

    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: string
    }

    const { access_token, refresh_token, expires_in } = tokenData
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString()

    // 2. Fetch Calendly user profile
    const profileRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileRes.ok) {
      console.error('[calendly oauth] Failed to fetch user profile', await profileRes.text())
      return NextResponse.redirect(`${redirectBase}&calendly=error`)
    }

    const profileData = await profileRes.json() as {
      resource: {
        uri: string
        name: string
        email: string
        current_organization: string
      }
    }

    const userUri: string = profileData.resource?.uri ?? ''
    const orgUri: string = profileData.resource?.current_organization ?? ''
    const userName: string = profileData.resource?.name ?? ''
    const userEmail: string = profileData.resource?.email ?? ''

    // 3. Get authenticated user from Supabase
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${appUrl}/auth/login`)
    }

    // 4. Upsert integration record
    const { error: upsertError } = await supabase
      .from('calendly_integrations')
      .upsert({
        user_id: user.id,
        access_token,
        refresh_token,
        token_expiry: tokenExpiry,
        user_uri: userUri,
        organization_uri: orgUri,
        user_name: userName,
        user_email: userEmail,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('[calendly oauth] Failed to upsert integration', upsertError)
      return NextResponse.redirect(`${redirectBase}&calendly=error`)
    }

    // 5. Create Calendly webhook subscription
    const webhookUrl = `${appUrl}/api/webhooks/calendly`

    const webhookRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['invitee.created'],
        organization: orgUri,
        user: userUri,
        scope: 'user',
      }),
    })

    if (!webhookRes.ok) {
      // Log but don't fail the whole flow — webhook can be re-registered later
      console.warn('[calendly oauth] Webhook subscription failed', await webhookRes.text())
    }

    return NextResponse.redirect(redirectBase)
  } catch (err) {
    console.error('[calendly oauth] Unexpected error', err)
    return NextResponse.redirect(`${redirectBase}&calendly=error`)
  }
}
