import { NextResponse } from 'next/server'

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

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
