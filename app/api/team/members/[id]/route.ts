import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  // Only allow updating safe fields
  const allowed: Record<string, unknown> = {}
  if (body.permissions) allowed.permissions = body.permissions
  if (body.status) allowed.status = body.status
  if (body.name) allowed.name = body.name
  if (body.role) allowed.role = body.role

  const { data, error } = await supabase
    .from('team_members')
    .update(allowed)
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}
