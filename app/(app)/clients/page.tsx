import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ClientsClient from './ClientsClient'
import type { Client, PaymentInstallment } from '@/types'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: clients }, { data: installments }, { data: profile }] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('payment_installments').select('*, clients!inner(user_id)').eq('clients.user_id', user.id),
    supabase.from('users').select('base_currency').eq('id', user.id).single(),
  ])

  return (
    <ClientsClient
      initialClients={(clients as Client[]) ?? []}
      installments={(installments as PaymentInstallment[]) ?? []}
      userId={user.id}
      baseCurrency={profile?.base_currency ?? 'NOK'}
    />
  )
}
