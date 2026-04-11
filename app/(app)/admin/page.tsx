import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import AdminClient from './AdminClient'
import type { User } from '@/types'

type LeadStage = 'follower' | 'replied' | 'freebie_sent' | 'call_booked' | 'second_call'
  | 'nurture' | 'bad_fit' | 'not_interested' | 'closed'

const REPLIED_STAGES: LeadStage[] = [
  'replied', 'freebie_sent', 'call_booked', 'second_call',
  'nurture', 'bad_fit', 'not_interested', 'closed',
]
const BOOKED_STAGES: LeadStage[] = ['call_booked', 'second_call', 'closed']

export interface CoachStats {
  userId: string
  name: string
  businessName: string
  currency: string
  activeClients: number
  lastLogin: string | null
  // All-time pipeline
  totalLeads: number
  totalReplied: number
  totalBooked: number
  totalClosed: number
  replyRate: number | null
  bookingRate: number | null
  closeRate: number | null
  // Numbers
  totalContractedValue: number  // sum of all active client total_amounts
  // This month
  cashThisMonth: number
  contractsThisMonth: number
  clientsSignedThisMonth: number
  callsThisMonth: number
  showUpRate: number | null
}

export default async function AdminPage() {
  const supabase      = await createServerSupabaseClient()
  const adminClient   = createAdminSupabaseClient()
  const currentMonth  = new Date().toISOString().slice(0, 7)

  // Fetch all coaches
  const { data: coaches } = await supabase
    .from('users')
    .select('id, name, business_name, base_currency, role')
    .in('role', ['coach', 'admin'])
    .order('created_at')

  if (!coaches) return <div style={{ padding: 40, color: 'var(--text-2)' }}>No coaches found.</div>

  // This week's Monday
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7))
  const thisWeekStart = monday.toISOString().slice(0, 10)

  const today = new Date().toISOString().slice(0, 10)

  // Fetch everything in parallel
  const [
    { data: allClients },
    { data: allLeads },
    { data: allSnapshots },
    { data: authData },
    { data: thisWeekCheckins },
    { data: allTeamMembers },
    { data: todayEods },
  ] = await Promise.all([
    supabase.from('clients').select('user_id, total_amount, payment_type, active'),
    supabase.from('leads').select('id, user_id, stage'),
    supabase.from('monthly_snapshots').select('*').eq('month', currentMonth),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('weekly_checkins').select('user_id, submitted_at').eq('week_start', thisWeekStart),
    supabase.from('team_members').select('id, coach_id, name, email, role, status').eq('status', 'active').order('created_at'),
    supabase.from('team_eod_reports').select('team_member_id, submitted_at').eq('date', today),
  ])

  // Build lookup maps
  const loginMap = new Map<string, string>()
  for (const u of authData?.users ?? []) {
    if (u.last_sign_in_at) loginMap.set(u.id, u.last_sign_in_at)
  }

  // Only count active clients
  const clientCounts = new Map<string, number>()
  const contractedValue = new Map<string, number>()
  for (const c of (allClients ?? []) as { user_id: string; total_amount: number; active: boolean }[]) {
    if (!c.active) continue
    clientCounts.set(c.user_id, (clientCounts.get(c.user_id) ?? 0) + 1)
    contractedValue.set(c.user_id, (contractedValue.get(c.user_id) ?? 0) + (c.total_amount ?? 0))
  }

  const snapshotByCoach = new Map<string, Record<string, unknown>>()
  for (const s of allSnapshots ?? []) {
    snapshotByCoach.set(s.user_id, s as Record<string, unknown>)
  }

  // Per-coach stats
  const coachStats: CoachStats[] = (coaches as User[]).map(coach => {
    const coachLeads  = (allLeads ?? []).filter(l => l.user_id === coach.id)
    const snap        = snapshotByCoach.get(coach.id)

    const totalLeads   = coachLeads.length
    const totalReplied = coachLeads.filter(l => REPLIED_STAGES.includes(l.stage as LeadStage)).length
    const totalBooked  = coachLeads.filter(l => BOOKED_STAGES.includes(l.stage as LeadStage)).length
    const totalClosed  = coachLeads.filter(l => l.stage === 'closed').length

    return {
      userId:       coach.id,
      name:         coach.name || coach.business_name || 'Unnamed',
      businessName: coach.business_name || '',
      currency:     coach.base_currency || 'USD',
      activeClients: clientCounts.get(coach.id) ?? 0,
      totalContractedValue: contractedValue.get(coach.id) ?? 0,
      lastLogin:    loginMap.get(coach.id) ?? null,
      totalLeads,
      totalReplied,
      totalBooked,
      totalClosed,
      replyRate:    totalLeads   > 0 ? Math.round((totalReplied / totalLeads)   * 100) : null,
      bookingRate:  totalReplied > 0 ? Math.round((totalBooked  / totalReplied) * 100) : null,
      closeRate:    totalBooked  > 0 ? Math.round((totalClosed  / totalBooked)  * 100) : null,
      cashThisMonth:          snap ? Number(snap.cash_collected)      || 0 : 0,
      contractsThisMonth:     snap ? Number(snap.revenue_contracted)  || 0 : 0,
      clientsSignedThisMonth: snap ? Number(snap.clients_signed)      || 0 : 0,
      callsThisMonth:         snap ? Number(snap.meetings_booked)     || 0 : 0,
      showUpRate:             snap ? (snap.show_up_rate as number | null ?? null) : null,
    }
  })

  // Which coaches haven't submitted this week
  const submittedIds = new Set((thisWeekCheckins ?? []).filter(c => c.submitted_at).map(c => c.user_id))
  const missingCheckins = coachStats
    .filter(c => !submittedIds.has(c.userId))
    .map(c => c.name)

  return (
    <AdminClient
      coachStats={coachStats}
      currentMonth={currentMonth}
      missingCheckins={missingCheckins}
      teamMembers={(allTeamMembers ?? []) as Array<{ id: string; coach_id: string; name: string; email: string; role: string; status: string }>}
      todayEods={(todayEods ?? []) as Array<{ team_member_id: string; submitted_at: string }>}
    />
  )
}
