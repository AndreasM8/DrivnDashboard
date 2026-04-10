import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TeamRole, TeamPermissions } from '@/types'

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
  return NextResponse.json({
    member: data,
    invite_url: `${appUrl}/join/${data.invite_token as string}`,
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
