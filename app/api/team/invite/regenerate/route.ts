import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { member_id?: string }
  if (!body.member_id) return NextResponse.json({ error: 'member_id is required' }, { status: 400 })

  // Verify the member belongs to this coach
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('id', body.member_id)
    .eq('coach_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const invite_token = crypto.randomUUID()
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('team_members')
    .update({ invite_token, invite_expires_at })
    .eq('id', body.member_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invite_token })
}
