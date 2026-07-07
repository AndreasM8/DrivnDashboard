import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getTeamSession } from '@/lib/team-auth'
import PipelineClient from '@/app/(app)/pipeline/PipelineClient'
import type { Lead, LeadLabel, Setter, KpiTargets } from '@/types'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function TeamPipelinePage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  // Check pipeline permission
  if (!session.member.permissions?.pipeline) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
          No access
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Your coach hasn&apos;t enabled pipeline access for your role.
        </p>
      </div>
    )
  }

  const coachId = session.coachId

  const [
    { data: leads },
    { data: labels },
    { data: setters },
    { data: assignments },
    { data: kpiTargets },
  ] = await Promise.all([
    admin.from('leads').select('*').eq('user_id', coachId).order('updated_at', { ascending: false }),
    admin.from('lead_labels').select('*').eq('user_id', coachId),
    admin.from('setters').select('*').eq('user_id', coachId).eq('active', true),
    admin.from('lead_label_assignments').select('*, leads!inner(user_id)').eq('leads.user_id', coachId),
    admin.from('kpi_targets').select('*').eq('user_id', coachId).maybeSingle(),
  ])

  return (
    <PipelineClient
      initialLeads={(leads as Lead[]) ?? []}
      labels={(labels as LeadLabel[]) ?? []}
      setters={(setters as Setter[]) ?? []}
      assignments={assignments ?? []}
      userId={coachId}
      kpiTargets={(kpiTargets as KpiTargets) ?? null}
      teamMode={true}
    />
  )
}
