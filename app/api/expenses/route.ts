import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (month) {
    query = query.eq('month', month)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expenses: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    month: string
    category: string
    label: string
    amount: number
    currency: string
    team_role?: string | null
    payment_structure?: string | null
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      month: body.month,
      category: body.category,
      label: body.label,
      amount: body.amount,
      currency: body.currency,
      team_role: body.team_role ?? null,
      payment_structure: body.payment_structure ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expense: data }, { status: 201 })
}
