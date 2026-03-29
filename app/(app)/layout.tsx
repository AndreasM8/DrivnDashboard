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

  // Check if owner
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  const isOwner = profile?.role === 'owner'

  return (
    <div className="flex h-full">
      <Sidebar taskBadge={badge} isOwner={isOwner} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader isOwner={isOwner} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav taskBadge={badge} isOwner={isOwner} />
    </div>
  )
}
