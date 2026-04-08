import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveUserId } from '@/lib/admin'
import type { WeeklyCheckin } from '@/types'
import CheckinsClient from './CheckinsClient'

export default async function CheckinsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()

  const [
    { data: profile },
    { data: checkins },
  ] = await Promise.all([
    supabase.from('users').select('base_currency').eq('id', user.id).single(),
    supabase
      .from('weekly_checkins')
      .select('*')
      .eq('user_id', uid)
      .not('submitted_at', 'is', null)
      .order('week_start', { ascending: false })
      .limit(24),
  ])

  const currency = (profile as { base_currency?: string } | null)?.base_currency ?? 'NOK'

  return (
    <CheckinsClient
      checkins={(checkins ?? []) as WeeklyCheckin[]}
      currency={currency}
    />
  )
}
