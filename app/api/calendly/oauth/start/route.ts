import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Derive the app origin from the incoming request — this is always correct
  // and avoids any env var mismatch with the Calendly developer portal.
  const { protocol, host } = new URL(request.url)
  const appUrl = `${protocol}//${host}`
  const redirectUri = `${appUrl}/api/calendly/oauth/callback`

  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
  })

  return NextResponse.redirect(
    `https://auth.calendly.com/oauth/authorize?${params.toString()}`
  )
}
