import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import BottomNav from '@/components/ui/BottomNav'
import MobileHeader from '@/components/ui/MobileHeader'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Get open task count for badge
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', false)
    .in('priority', ['overdue', 'today'])

  const badge = taskCount ?? 0

  // Determine if this user is a workspace owner vs a team member.
  // Team members have a record in team_members where workspace_id != their own user.id.
  // For now all coaches who sign up directly are owners.
  const { data: teamMembership } = await supabase
    .from('team_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .neq('workspace_id', user.id)
    .limit(1)
    .maybeSingle()
  const isOwner = !teamMembership  // if no external membership, they're the owner

  return (
    <div className="flex h-full">
      <Sidebar taskBadge={badge} isOwner={isOwner} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader isOwner={isOwner} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 dark:bg-slate-900">
          {children}
        </main>
      </div>

      <BottomNav taskBadge={badge} isOwner={isOwner} />
    </div>
  )
}
