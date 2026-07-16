import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getEffectiveUserId } from '@/lib/admin'

// Deletes all leads except stage='follower' — keeps the follower base intact
export async function DELETE(): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = await getEffectiveUserId()
  const admin = createAdminSupabaseClient()

  const { error, count } = await admin
    .from('leads')
    .delete({ count: 'exact' })
    .eq('user_id', uid)
    .neq('stage', 'follower')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: count ?? 0 })
}
