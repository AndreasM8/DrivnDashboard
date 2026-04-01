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

  function fail(step: string, detail?: string) {
    const params = new URLSearchParams({ calendly: 'error', step })
    if (detail) params.set('detail', detail.slice(0, 120))
    return NextResponse.redirect(`${redirectBase}&${params.toString()}`)
  }

  if (error || !code) {
    return fail('denied', error ?? 'no_code')
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
      const body = await tokenRes.text()
      console.error('[calendly oauth] Token exchange failed', tokenRes.status, body)
      return fail('token', `${tokenRes.status}: ${body}`)
    }

    // Calendly includes owner + organization URIs directly in the token response
    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: string
      owner: string        // e.g. https://api.calendly.com/users/XXXX
      organization: string // e.g. https://api.calendly.com/organizations/XXXX
    }

    const { access_token, refresh_token, expires_in } = tokenData
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString()
    const userUri: string = tokenData.owner ?? ''
    const orgUri: string = tokenData.organization ?? ''

    // 2. Try to fetch display name + email using the owner URI from the token.
    //    Calling the specific user URI directly works without extra scopes,
    //    unlike /users/me which requires an explicit profile scope.
    let userName = ''
    let userEmail = ''
    if (userUri) {
      try {
        const profileRes = await fetch(userUri, {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        if (profileRes.ok) {
          const profileData = await profileRes.json() as {
            resource: { name?: string; email?: string }
          }
          userName = profileData.resource?.name ?? ''
          userEmail = profileData.resource?.email ?? ''
        } else {
          console.warn('[calendly oauth] Profile fetch failed', profileRes.status)
        }
      } catch {
        console.warn('[calendly oauth] Profile fetch threw, continuing without name/email')
      }
    }

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
      return fail('db', upsertError.message)
    }

    // 5. Create / recycle Calendly webhook subscription
    const webhookUrl = `${appUrl}/api/webhooks/calendly`

    async function createWebhook(): Promise<string | null> {
      const res = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
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
      console.warn('[calendly oauth] Webhook create failed', res.status, await res.text())
      return null
    }

    let signingKey = await createWebhook()

    // If creation failed (likely duplicate), delete existing and recreate
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
            await fetch(existing.uri, { method: 'DELETE', headers: { Authorization: `Bearer ${access_token}` } })
            signingKey = await createWebhook()
          }
        }
      } catch (webhookErr) {
        console.warn('[calendly oauth] Could not recycle webhook', webhookErr)
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
    return fail('exception', String(err).slice(0, 120))
  }
}
