import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Validate token by calling Calendly API
  const res = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid token — please check and try again' }, { status: 400 })
  }

  const data = await res.json()
  const userUri: string = data.resource?.uri ?? ''
  const orgUri: string = data.resource?.current_organization ?? ''

  // Save to Supabase
  await supabase.from('calendly_integrations').upsert({
    user_id: user.id,
    access_token: token,
    user_uri: userUri,
    organization_uri: orgUri,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({
    ok: true,
    name: data.resource?.name,
    email: data.resource?.email,
  })
}
