import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import { redirect } from 'next/navigation'
import ClientsClient from './ClientsClient'
import type { Client, PaymentInstallment, Product } from '@/types'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()

  const [{ data: clients }, { data: installments }, { data: profile }, { data: products }] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', uid).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('payment_installments').select('*, clients!inner(user_id)').eq('clients.user_id', user.id),
    supabase.from('users').select('base_currency').eq('id', user.id).single(),
    supabase.from('products').select('*').eq('user_id', uid).eq('active', true).order('created_at'),
  ])

  return (
    <ClientsClient
      initialClients={(clients as Client[]) ?? []}
      installments={(installments as PaymentInstallment[]) ?? []}
      userId={user.id}
      baseCurrency={profile?.base_currency ?? 'NOK'}
      products={(products as Product[]) ?? []}
    />
  )
}
