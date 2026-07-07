import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { memberId?: string }
  if (!body.memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Verify this membership belongs to the requesting user
  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id')
    .eq('id', body.memberId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('drivn_active_workspace', body.memberId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
