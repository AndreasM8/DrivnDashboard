import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import type { TeamRole, TeamPermissions } from '@/types'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function sendInviteEmail({
  to, name, coachName, inviteUrl,
}: { to: string; name: string; coachName: string; inviteUrl: string }) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Drivn <noreply@drivnscaling.com>',
      to,
      subject: `${coachName} invited you to join their team on Drivn`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">You've been invited 🎉</h2>
          <p style="color:#6b7280;margin-bottom:8px">Hi ${name},</p>
          <p style="color:#6b7280;margin-bottom:24px">
            <strong style="color:#111827">${coachName}</strong> has invited you to join their team on Drivn.
            Click the button below to accept and set up your account.
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Accept invite
          </a>
          <p style="color:#9ca3af;font-size:13px;margin-top:24px">
            This invite link expires in 7 days. If you didn't expect this, you can safely ignore it.
          </p>
        </div>
      `,
    }),
  })
}

const DEFAULT_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
  setter: { pipeline: true,  clients: false, finances: false, labels: true,  content: false },
  closer: { pipeline: true,  clients: true,  finances: true,  labels: false, content: false },
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure user is a coach
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['coach', 'admin'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { role: TeamRole; name: string; email: string; permissions?: TeamPermissions }
  if (!body.role || !body.name || !body.email) {
    return NextResponse.json({ error: 'role, name and email are required' }, { status: 400 })
  }

  // Get coach name for the invite email
  const { data: coachProfile } = await supabase
    .from('users')
    .select('name, business_name')
    .eq('id', user.id)
    .single()
  const coachName = (coachProfile as { name?: string; business_name?: string } | null)?.name
    || (coachProfile as { name?: string; business_name?: string } | null)?.business_name
    || 'Your coach'

  const permissions = body.permissions ?? DEFAULT_PERMISSIONS[body.role]

  const { data, error } = await supabase
    .from('team_members')
    .insert({
      coach_id: user.id,
      role: body.role,
      name: body.name,
      email: body.email,
      permissions,
      status: 'invited',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also create default EOD template
  const defaultQuestions = body.role === 'setter'
    ? ['New followers today', 'Followups to hot leads', 'Followups to warm leads', 'Followups to cold leads', 'New replies received', 'Offers sent', 'Calls booked', "Today's highlight"]
    : ['Calls taken today', 'Deals closed', 'Revenue closed', 'No-shows', 'Reschedules', "Today's highlight / blocker"]

  await supabase.from('team_checkin_templates').insert({
    team_member_id: data.id,
    coach_id: user.id,
    type: 'eod',
    questions: defaultQuestions.map((label, i) => ({
      id: `q${i}`,
      label,
      type: i === defaultQuestions.length - 1 ? 'textarea' : 'number',
      required: false,
    })),
    weekly_enabled: false,
    weekly_day: 0,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/join/${data.invite_token as string}`

  // Send invite email (best-effort — don't block response on failure)
  sendInviteEmail({ to: body.email, name: body.name, coachName, inviteUrl }).catch(err =>
    console.error('Failed to send invite email:', err)
  )

  return NextResponse.json({
    member: data,
    invite_url: inviteUrl,
  }, { status: 201 })
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data })
}
