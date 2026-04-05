import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface ViewAsBody {
  coachId: string
  coachName: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as ViewAsBody
  const { coachId, coachName } = body

  if (!coachId || !coachName) {
    return NextResponse.json({ error: 'Missing coachId or coachName' }, { status: 400 })
  }

  // Validate coachId is a real coach
  const { data: coach } = await supabase
    .from('users')
    .select('id')
    .eq('id', coachId)
    .eq('role', 'coach')
    .single()

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('drivn_view_as', JSON.stringify({ coachId, coachName }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8-hour session cap
  })
  return response
}
