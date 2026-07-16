import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getEffectiveUserId } from '@/lib/admin'
import type { ImportClientRecord } from '@/lib/csv-parser'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = await getEffectiveUserId()
  const { clients, currency } = await req.json() as {
    clients: ImportClientRecord[]
    currency: string
  }

  if (!clients?.length) return NextResponse.json({ created: 0, skipped: 0 })

  const adminClient = createAdminSupabaseClient()

  // Fetch existing client names to skip duplicates
  const { data: existing } = await adminClient
    .from('clients')
    .select('full_name')
    .eq('user_id', uid)

  const existingNames = new Set((existing ?? []).map(c => c.full_name.toLowerCase().trim()))

  const toInsert = clients
    .filter(c => c.full_name && !existingNames.has(c.full_name.toLowerCase().trim()))
    .map(c => ({
      user_id:        uid,
      full_name:      c.full_name,
      ig_username:    c.full_name,
      email:          '',
      phone:          '',
      program_type:   c.program_type,
      payment_type:   c.payment_type,
      plan_months:    c.plan_months,
      monthly_amount: c.monthly_amount,
      total_amount:   c.total_amount,
      total_paid:     c.total_paid,
      currency:       currency || 'NOK',
      started_at:     c.started_at,
      active:         true,
      notes:          '',
      churn_reason:   '',
    }))

  const skipped = clients.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped })
  }

  const { error } = await adminClient.from('clients').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: toInsert.length, skipped })
}
