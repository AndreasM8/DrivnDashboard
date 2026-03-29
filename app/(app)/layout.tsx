import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import BottomNav from '@/components/ui/BottomNav'

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

  return (
    <div className="flex h-full">
      <Sidebar taskBadge={badge} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      <BottomNav taskBadge={badge} />
    </div>
  )
}
