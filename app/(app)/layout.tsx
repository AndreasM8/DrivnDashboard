import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Sidebar from '@/components/ui/Sidebar'
import BottomNav from '@/components/ui/BottomNav'
import MobileHeader from '@/components/ui/MobileHeader'
import ViewAsBanner from '@/components/ui/ViewAsBanner'
import type { AdminViewAs } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const cookieStore = await cookies()
  const viewAsRaw = cookieStore.get('drivn_view_as')?.value ?? null
  let viewAs: AdminViewAs | null = null
  if (viewAsRaw) {
    try { viewAs = JSON.parse(viewAsRaw) as AdminViewAs } catch { /* ignore */ }
  }

  const [
    { count: taskCount },
    { data: teamMembership },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false)
      .in('priority', ['overdue', 'today']),
    supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .neq('workspace_id', user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  const badge = taskCount ?? 0
  const isOwner = !teamMembership
  const isAdmin = profile?.role === 'admin'

  // Strip view-as if current user is not actually admin (tamper protection)
  if (viewAs && !isAdmin) viewAs = null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {viewAs && <ViewAsBanner coachName={viewAs.coachName} />}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar taskBadge={badge} isOwner={isOwner} isAdmin={isAdmin} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MobileHeader isOwner={isOwner} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ background: 'var(--bg-base)' }}>
            {children}
          </main>
        </div>
        <BottomNav taskBadge={badge} isOwner={isOwner} />
      </div>
    </div>
  )
}
