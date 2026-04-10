import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import type { TeamEodReport } from '@/types'

export default async function PerformancePage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()

  const { data: reports } = await supabase
    .from('team_eod_reports')
    .select('*')
    .eq('team_member_id', session.member.id)
    .order('date', { ascending: false })
    .limit(14)

  const eods = (reports ?? []) as TeamEodReport[]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Performance
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Your last 14 end-of-day reports
        </p>
      </div>

      {eods.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📈</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No reports yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Submit your first EOD report to track performance.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {eods.map(report => (
            <div
              key={report.id}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  {new Date(report.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,0.1)',
                  color: '#10B981', padding: '2px 8px', borderRadius: 6,
                }}>
                  Submitted
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(report.answers as Array<{ question_id: string; value: string | number | boolean }>).map((answer, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>Q{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, maxWidth: '70%', textAlign: 'right' }}>
                      {String(answer.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
