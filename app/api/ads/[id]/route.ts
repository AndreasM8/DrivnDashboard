import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = await getEffectiveUserId()

  const { id } = await params
  const body = await request.json() as {
    daily_budget?: number
    total_spend?: number
    followers_generated?: number
    ended_at?: string | null
  }

  const updates: Record<string, unknown> = {}
  if (body.daily_budget !== undefined) updates.daily_budget = body.daily_budget
  if (body.total_spend !== undefined) updates.total_spend = body.total_spend
  if (body.followers_generated !== undefined) updates.followers_generated = body.followers_generated
  if (body.ended_at !== undefined) updates.ended_at = body.ended_at

  const { data, error } = await supabase
    .from('ads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ad: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = await getEffectiveUserId()

  const { id } = await params

  const { error } = await supabase
    .from('ads')
    .delete()
    .eq('id', id)
    .eq('user_id', uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
