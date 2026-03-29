import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EodClient from './EodClient'
import type { EodReport, Setter } from '@/types'

export default async function EodPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: setters }, { data: todayReport }, { data: reports }] = await Promise.all([
    supabase.from('setters').select('*').eq('user_id', user.id).eq('active', true),
    supabase.from('eod_reports').select('*').eq('workspace_id', user.id).eq('date', today).single(),
    supabase.from('eod_reports').select('*').eq('workspace_id', user.id).order('date', { ascending: false }).limit(30),
  ])

  return (
    <EodClient
      userId={user.id}
      setters={(setters as Setter[]) ?? []}
      todayReport={(todayReport as EodReport) ?? null}
      reports={(reports as EodReport[]) ?? []}
    />
  )
}
