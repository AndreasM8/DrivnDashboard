import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'
import type { Lead, LeadLabel, Setter } from '@/types'

export default async function PipelinePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: leads },
    { data: labels },
    { data: setters },
    { data: assignments },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .not('stage', 'in', '("bad_fit","not_interested")')
      .order('updated_at', { ascending: false }),
    supabase.from('lead_labels').select('*').eq('user_id', user.id),
    supabase.from('setters').select('*').eq('user_id', user.id).eq('active', true),
    supabase.from('lead_label_assignments').select('*'),
  ])

  return (
    <PipelineClient
      initialLeads={(leads as Lead[]) ?? []}
      labels={(labels as LeadLabel[]) ?? []}
      setters={(setters as Setter[]) ?? []}
      assignments={assignments ?? []}
      userId={user.id}
    />
  )
}
