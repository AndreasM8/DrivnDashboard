import { NextResponse } from 'next/server'
import { syncToSheets, getOAuthClient } from '@/lib/google-sheets'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function refreshGoogleToken(userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('google_integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()

  if (!data?.refresh_token) return false

  try {
    const oauth2 = getOAuthClient()
    oauth2.setCredentials({ refresh_token: data.refresh_token })
    const { credentials } = await oauth2.refreshAccessToken()

    if (!credentials.access_token) return false

    await supabase.from('google_integrations').update({
      access_token: credentials.access_token,
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
    }).eq('user_id', userId)

    return true
  } catch {
    return false
  }
}

function isTokenExpiry(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return msg.includes('invalid_grant') || msg.includes('Token has been expired') || msg.includes('Invalid Credentials')
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // googleapis surfaces quota errors as messages containing 429 or specific text
  return err.message.includes('429') || err.message.toLowerCase().includes('quota')
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncToSheets(user.id)
    return NextResponse.json(result)
  } catch (err) {
    // Quota exceeded
    if (isQuotaError(err)) {
      return NextResponse.json(
        { error: 'Google API quota exceeded — sync will retry shortly' },
        { status: 429 }
      )
    }

    // Token expiry — try to refresh and retry once
    if (isTokenExpiry(err)) {
      const refreshed = await refreshGoogleToken(user.id)
      if (refreshed) {
        try {
          const result = await syncToSheets(user.id)
          return NextResponse.json(result)
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : 'Sync failed after token refresh'
          return NextResponse.json({ error: retryMsg }, { status: 500 })
        }
      }
      return NextResponse.json(
        { error: 'Google auth expired — please reconnect in Settings' },
        { status: 401 }
      )
    }

    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
