import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'
import type { Lead, LeadLabel, Setter, KpiTargets } from '@/types'

export default async function PipelinePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()

  const [
    { data: leads },
    { data: labels },
    { data: setters },
    { data: assignments },
    { data: kpiTargets },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false }),
    supabase.from('lead_labels').select('*').eq('user_id', uid),
    supabase.from('setters').select('*').eq('user_id', uid).eq('active', true),
    supabase.from('lead_label_assignments').select('*, leads!inner(user_id)').eq('leads.user_id', user.id),
    supabase.from('kpi_targets').select('*').eq('user_id', uid).maybeSingle(),
  ])

  return (
    <PipelineClient
      initialLeads={(leads as Lead[]) ?? []}
      labels={(labels as LeadLabel[]) ?? []}
      setters={(setters as Setter[]) ?? []}
      assignments={assignments ?? []}
      userId={user.id}
      kpiTargets={(kpiTargets as KpiTargets) ?? null}
    />
  )
}
