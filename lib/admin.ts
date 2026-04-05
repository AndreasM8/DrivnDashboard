import { cookies } from 'next/headers'
import { createServerSupabaseClient } from './supabase-server'
import type { AdminViewAs } from '@/types'

export async function getViewAsContext(): Promise<AdminViewAs | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('drivn_view_as')?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'coachId' in parsed &&
      'coachName' in parsed &&
      typeof (parsed as Record<string, unknown>).coachId === 'string' &&
      typeof (parsed as Record<string, unknown>).coachName === 'string'
    ) {
      return parsed as AdminViewAs
    }
    return null
  } catch {
    return null
  }
}

// Returns the user_id to use for data queries.
// When admin is in "view as" mode, returns the coach's ID.
// Otherwise returns the authenticated user's own ID.
export async function getEffectiveUserId(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const viewAs = await getViewAsContext()
  if (!viewAs) return user.id

  // Verify the actual user is admin before trusting the cookie
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return user.id
  return viewAs.coachId
}
