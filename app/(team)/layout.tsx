import { redirect } from 'next/navigation'
import { getTeamSession } from '@/lib/team-auth'
import TeamSidebar from '@/components/team/TeamSidebar'

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TeamSidebar member={session.member} />
      <main style={{ flex: 1, padding: '24px 24px 88px', maxWidth: '100%', overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
