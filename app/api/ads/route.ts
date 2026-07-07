import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ads: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name: string
    platform?: string
    started_at: string
    ended_at?: string | null
    daily_budget: number
    total_spend?: number
    currency: string
  }

  // Only auto-close the previous active ad if the new one has no end date (i.e. it's currently running)
  if (!body.ended_at) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('ads')
      .update({ ended_at: body.started_at ?? today })
      .eq('user_id', user.id)
      .is('ended_at', null)
  }

  const { data, error } = await supabase
    .from('ads')
    .insert({
      user_id: user.id,
      name: body.name,
      platform: body.platform ?? null,
      started_at: body.started_at,
      ended_at: body.ended_at ?? null,
      daily_budget: body.daily_budget,
      total_spend: body.total_spend ?? 0,
      currency: body.currency,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ad: data }, { status: 201 })
}
