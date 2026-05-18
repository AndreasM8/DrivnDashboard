import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Lightweight ping to keep Supabase from pausing due to inactivity.
// Uses service role key so it works with no auth session (cron job context).
// Called daily by Vercel cron (vercel.json).
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[health] ping failed:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
