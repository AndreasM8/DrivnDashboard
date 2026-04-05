import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import type { KpiTargets, Setter, User, SecondaryCurrency } from '@/types'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; google?: string; calendly?: string; step?: string; detail?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams

  const [{ data: profile }, { data: targets }, { data: setters }, { data: currencies }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('kpi_targets').select('*').eq('user_id', user.id).single(),
    supabase.from('setters').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
    supabase.from('secondary_currencies').select('*').eq('user_id', user.id),
  ])

  return (
    <SettingsClient
      userId={user.id}
      userEmail={user.email ?? ''}
      profile={profile as User}
      targets={targets as KpiTargets ?? null}
      setters={(setters as Setter[]) ?? []}
      secondaryCurrencies={(currencies as SecondaryCurrency[]) ?? []}
      initialSection={params.section === 'integrations' ? 'integrations' : undefined}
      calendlyResult={params.calendly === 'error' ? 'error' : params.calendly === 'ok' ? 'ok' : undefined}
      calendlyErrorStep={params.step}
      calendlyErrorDetail={params.detail}
    />
  )
}
