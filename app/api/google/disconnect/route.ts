import { NextResponse } from 'next/server'
import { getOAuthClient } from '@/lib/google-sheets'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get current token to revoke it
  const { data } = await supabase
    .from('google_integrations')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (data?.access_token) {
    try {
      const oauth2 = getOAuthClient()
      await oauth2.revokeToken(data.access_token)
    } catch {
      // Token may already be expired — delete from DB regardless
    }
  }

  await supabase.from('google_integrations').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
