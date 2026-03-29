import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import NumbersClient from './NumbersClient'
import type { KpiTargets, MonthlySnapshot, Client, PaymentInstallment } from '@/types'

export default async function NumbersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const currentMonth = new Date().toISOString().slice(0, 7)
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  const [
    { data: profile },
    { data: targets },
    { data: snapshots },
    { data: clients },
    { data: installments },
  ] = await Promise.all([
    supabase.from('users').select('base_currency, name').eq('id', user.id).single(),
    supabase.from('kpi_targets').select('*').eq('user_id', user.id).single(),
    supabase.from('monthly_snapshots').select('*').eq('user_id', user.id).order('month', { ascending: false }).limit(7),
    supabase.from('clients').select('*').eq('user_id', user.id).eq('active', true),
    supabase.from('payment_installments').select('*'),
  ])

  const currentSnapshot = snapshots?.find(s => s.month === currentMonth)
  const lastMonthSnapshot = snapshots?.find(s => s.month === lastMonth)

  return (
    <NumbersClient
      baseCurrency={profile?.base_currency ?? 'NOK'}
      targets={(targets as KpiTargets) ?? null}
      currentSnapshot={(currentSnapshot as MonthlySnapshot) ?? null}
      lastMonthSnapshot={(lastMonthSnapshot as MonthlySnapshot) ?? null}
      history={(snapshots as MonthlySnapshot[]) ?? []}
      clients={(clients as Client[]) ?? []}
      installments={(installments as PaymentInstallment[]) ?? []}
      currentMonth={currentMonth}
    />
  )
}
