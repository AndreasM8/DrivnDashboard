import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Lightweight ping to keep Supabase from pausing due to inactivity.
// Called daily by Vercel cron (vercel.json).
export async function GET() {
  try {
    const supabase = await createClient()
    await supabase.from('users').select('id').limit(1)
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
