import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url)
  const { searchParams } = reqUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Always derive from the request — must match what start/route.ts sends
  const appUrl = `${reqUrl.protocol}//${reqUrl.host}`
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

    // 5. Create Calendly webhook subscription and capture signing key
    const webhookUrl = `${appUrl}/api/webhooks/calendly`

    async function createWebhook(): Promise<string | null> {
      const res = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['invitee.created', 'invitee.canceled'],
          organization: orgUri,
          user: userUri,
          scope: 'user',
        }),
      })
      if (res.ok) {
        const data = await res.json() as { resource?: { signing_key?: string } }
        return data?.resource?.signing_key ?? null
      }
      // 409 = already exists; anything else is unexpected
      const errText = await res.text()
      console.warn('[calendly oauth] Webhook create failed', res.status, errText)
      return null
    }

    let signingKey = await createWebhook()

    // If creation failed (likely a duplicate), find and delete the existing one then retry
    if (signingKey === null) {
      try {
        const listRes = await fetch(
          `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&user=${encodeURIComponent(userUri)}&scope=user`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        )
        if (listRes.ok) {
          const listData = await listRes.json() as { collection?: { uri: string; callback_url: string }[] }
          const existing = listData.collection?.find(w => w.callback_url === webhookUrl)
          if (existing) {
            // Delete the old webhook and recreate to get a fresh signing key
            await fetch(existing.uri, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${access_token}` },
            })
            signingKey = await createWebhook()
          }
        }
      } catch (webhookErr) {
        console.warn('[calendly oauth] Could not recycle existing webhook', webhookErr)
      }
    }

    if (signingKey) {
      await supabase
        .from('calendly_integrations')
        .update({ webhook_signing_key: signingKey })
        .eq('user_id', user.id)
    }

    return NextResponse.redirect(redirectBase)
  } catch (err) {
    console.error('[calendly oauth] Unexpected error', err)
    return NextResponse.redirect(`${redirectBase}&calendly=error`)
  }
}
