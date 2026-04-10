import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('team_non_negotiables')
    .select('*')
    .eq('team_member_id', id)
    .eq('coach_id', user.id)
    .order('order_index')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ non_negs: data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { title: string; order_index?: number }

  const { data, error } = await supabase
    .from('team_non_negotiables')
    .insert({ team_member_id: id, coach_id: user.id, title: body.title, order_index: body.order_index ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ non_neg: data }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: memberId } = await params
  const { searchParams } = new URL(request.url)
  const nonNegId = searchParams.get('non_neg_id')
  if (!nonNegId) return NextResponse.json({ error: 'non_neg_id required' }, { status: 400 })

  const { error } = await supabase
    .from('team_non_negotiables')
    .delete()
    .eq('id', nonNegId)
    .eq('team_member_id', memberId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
