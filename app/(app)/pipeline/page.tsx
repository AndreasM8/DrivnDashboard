import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'
import type { Lead, LeadLabel, Setter, KpiTargets } from '@/types'

async function fetchAllLeads(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, uid: string): Promise<Lead[]> {
  const PAGE = 1000
  const all: Lead[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as Lead[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export default async function PipelinePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()

  const [leads, [{ data: labels }, { data: setters }, { data: assignments }, { data: kpiTargets }]] = await Promise.all([
    fetchAllLeads(supabase, uid),
    Promise.all([
      supabase.from('lead_labels').select('*').eq('user_id', uid),
      supabase.from('setters').select('*').eq('user_id', uid).eq('active', true),
      supabase.from('lead_label_assignments').select('*, leads!inner(user_id)').eq('leads.user_id', user.id),
      supabase.from('kpi_targets').select('*').eq('user_id', uid).maybeSingle(),
    ]),
  ])

  return (
    <PipelineClient
      initialLeads={leads}
      labels={(labels as LeadLabel[]) ?? []}
      setters={(setters as Setter[]) ?? []}
      assignments={assignments ?? []}
      userId={user.id}
      kpiTargets={(kpiTargets as KpiTargets) ?? null}
    />
  )
}
