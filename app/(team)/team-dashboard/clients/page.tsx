import { redirect } from 'next/navigation'
import { getTeamSession } from '@/lib/team-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ClientsTeamClient from './ClientsTeamClient'
import type { Client, PaymentInstallment } from '@/types'

export default async function TeamClientsPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')
  if (!session.member.permissions.clients) redirect('/team-dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: clients }, { data: installments }] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('user_id', session.coachId)
      .eq('active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('payment_installments')
      .select('*')
      .in(
        'client_id',
        // Sub-select: get client IDs that belong to this coach
        (await supabase.from('clients').select('id').eq('user_id', session.coachId).eq('active', true)).data?.map(c => c.id) ?? []
      ),
  ])

  return (
    <ClientsTeamClient
      clients={(clients as Client[]) ?? []}
      installments={(installments as PaymentInstallment[]) ?? []}
      hasFinances={session.member.permissions.finances}
    />
  )
}
