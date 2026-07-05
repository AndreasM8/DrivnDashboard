import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json() as { token: string }
  if (!body.token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id, name, email, status, invite_expires_at, role')
    .eq('invite_token', body.token)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (member.status === 'active') return NextResponse.json({ error: 'Already active' }, { status: 400 })
  if (new Date(member.invite_expires_at as string) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

  try {
    // Generate a magic link token via admin API
    const { data: linkData, error: otpError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: member.email as string,
    })

    if (otpError || !linkData) {
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 })
    }

    const tokenHash = (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token
    if (!tokenHash) {
      return NextResponse.json({ error: 'Could not extract login token' }, { status: 500 })
    }

    // Build verify URL that, after OTP verification, routes to team-callback
    const verifyUrl = `${appUrl}/auth/verify?token_hash=${tokenHash}&type=magiclink&team_token=${body.token}`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Drivn <noreply@drivnscaling.com>',
        to: member.email,
        subject: 'Your Drivn login link',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Sign in to Drivn</h2>
            <p style="color:#6b7280;margin-bottom:8px">Hi ${member.name as string},</p>
            <p style="color:#6b7280;margin-bottom:24px">
              Click the button below to sign in and access your team dashboard. This link expires in 1 hour.
            </p>
            <a href="${verifyUrl}"
               style="display:inline-block;background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Sign in to Drivn
            </a>
            <p style="color:#9ca3af;font-size:13px;margin-top:24px">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error('Resend error in team/join:', errBody)
      return NextResponse.json({ error: 'Failed to send login email' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
