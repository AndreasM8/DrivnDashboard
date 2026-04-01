import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const nowIso = now.toISOString()

  // Update lead — only if it belongs to this user
  const { error: leadError } = await supabase
    .from('leads')
    .update({ last_contact_at: nowIso })
    .eq('id', id)
    .eq('user_id', user.id)

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  // Snooze any open follow_up task for this lead: push due_at 3 days out
  const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000).toISOString()

  await supabase
    .from('tasks')
    .update({ due_at: threeDaysFromNow, completed: false })
    .eq('lead_id', id)
    .eq('user_id', user.id)
    .eq('type', 'follow_up')
    .eq('completed', false)

  return NextResponse.json({ ok: true, last_contact_at: nowIso })
}
