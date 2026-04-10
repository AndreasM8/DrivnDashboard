import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { language: string }
  if (!['en', 'no'].includes(body.language)) {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
  }

  await supabase.from('users').update({ language: body.language }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
