import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import AdminClient from './AdminClient'
import type { User } from '@/types'

interface CoachRow {
  id: string
  name: string
  businessName: string
  currency: string
  activeClients: number
  lastLogin: string | null
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const adminClient = createAdminSupabaseClient()

  // Fetch all coaches
  const { data: coaches } = await supabase
    .from('users')
    .select('id, name, business_name, base_currency, role')
    .eq('role', 'coach')
    .order('created_at')

  if (!coaches) return <div style={{ padding: 40, color: 'var(--text-2)' }}>No coaches found.</div>

  // Fetch all active clients to count per coach
  const { data: allClients } = await supabase
    .from('clients')
    .select('user_id')

  // Fetch last login times via admin API (needs service role key)
  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const loginMap = new Map<string, string>()
  if (authData?.users) {
    for (const u of authData.users) {
      if (u.last_sign_in_at) loginMap.set(u.id, u.last_sign_in_at)
    }
  }

  const clientCounts = new Map<string, number>()
  for (const c of allClients ?? []) {
    clientCounts.set(c.user_id, (clientCounts.get(c.user_id) ?? 0) + 1)
  }

  const rows: CoachRow[] = (coaches as User[]).map(coach => ({
    id: coach.id,
    name: coach.name || coach.business_name || 'Unnamed',
    businessName: coach.business_name || '',
    currency: coach.base_currency || 'USD',
    activeClients: clientCounts.get(coach.id) ?? 0,
    lastLogin: loginMap.get(coach.id) ?? null,
  }))

  return <AdminClient coaches={rows} />
}
