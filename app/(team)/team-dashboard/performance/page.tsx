import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import type { TeamEodReport } from '@/types'

function computeStreak(reports: TeamEodReport[], today: string): number {
  const submittedDates = new Set(reports.map(r => r.date))
  let streak = 0
  const check = new Date(today)
  for (let i = 0; i < 30; i++) {
    const dateStr = check.toISOString().slice(0, 10)
    if (submittedDates.has(dateStr)) {
      streak++
      check.setDate(check.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default async function PerformancePage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: reports }, { data: templateData }] = await Promise.all([
    supabase
      .from('team_eod_reports')
      .select('*')
      .eq('team_member_id', session.member.id)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('team_checkin_templates')
      .select('questions')
      .eq('team_member_id', session.member.id)
      .eq('type', 'eod')
      .maybeSingle(),
  ])

  const eods = (reports ?? []) as TeamEodReport[]

  const questions = (templateData?.questions as Array<{ id: string; label: string }> | null) ?? []
  const labelMap: Record<string, string> = {}
  for (const q of questions) labelMap[q.id] = q.label

  const totalReports = eods.length
  const streak = computeStreak(eods, today)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Performance
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Your last 30 end-of-day reports
        </p>
      </div>

      {/* Summary strip */}
      {totalReports > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
        }}>
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding: '12px 16px', flex: 1, minWidth: 120,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total submitted
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0, lineHeight: 1 }}>
              {totalReports}
            </p>
          </div>
          <div style={{
            background: streak > 0 ? 'rgba(245,158,11,0.08)' : 'var(--surface-1)',
            border: `1px solid ${streak > 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-card)', padding: '12px 16px', flex: 1, minWidth: 120,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Current streak
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: streak > 0 ? '#F59E0B' : 'var(--text-1)', margin: 0, lineHeight: 1 }}>
              {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '—'}
            </p>
          </div>
        </div>
      )}

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
                    <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>
                      {labelMap[answer.question_id] ?? `Q${i + 1}`}
                    </span>
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
