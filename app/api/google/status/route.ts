import { NextResponse } from 'next/server'
import { getIntegration } from '@/lib/google-sheets'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false })
  }

  const integration = await getIntegration(user.id)

  if (!integration) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    spreadsheet_url: integration.spreadsheet_url,
    last_synced_at: integration.last_synced_at,
  })
}
