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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectTo = `${appUrl}/auth/team-callback?token=${body.token}`

  try {
    // Use Supabase's built-in OTP email — no external email provider needed
    const { error: otpError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: member.email as string,
      options: { redirectTo },
    })

    if (otpError) {
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
