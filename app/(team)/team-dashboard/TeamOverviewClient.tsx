'use client'

import Link from 'next/link'
import type { TeamMember, TeamNonNeg, TeamTask, TeamPersonalTask } from '@/types'

interface Props {
  member: TeamMember
  nonNegs: TeamNonNeg[]
  completedNonNegIds: string[]
  totalNonNegs: number
  completedNonNegs: number
  openTeamTasks: TeamTask[]
  openPersonalTasks: TeamPersonalTask[]
  eodSubmitted: boolean
  today: string
}

const CARD: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 20,
}

export default function TeamOverviewClient({
  member,
  totalNonNegs,
  completedNonNegs,
  openTeamTasks,
  openPersonalTasks,
  eodSubmitted,
}: Props) {
  const nnPct = totalNonNegs > 0 ? Math.round((completedNonNegs / totalNonNegs) * 100) : 0

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Hey {member.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* EOD banner */}
      {!eodSubmitted && (
        <div style={{
          background: 'rgba(37,99,235,0.08)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
              End of day report pending
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              Submit today&apos;s EOD before you sign off
            </p>
          </div>
          <Link
            href="/team-dashboard/eod"
            style={{
              padding: '8px 16px', background: '#2563EB', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Submit EOD
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard
          label="Non-negotiables"
          value={`${completedNonNegs}/${totalNonNegs}`}
          sub={`${nnPct}% done`}
          href="/team-dashboard/non-negotiables"
          accent={nnPct === 100 ? '#10B981' : undefined}
        />
        <StatCard
          label="Team tasks"
          value={String(openTeamTasks.length)}
          sub="open"
          href="/team-dashboard/team-tasks"
        />
        <StatCard
          label="My tasks"
          value={String(openPersonalTasks.length)}
          sub="open"
          href="/team-dashboard/my-tasks"
        />
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <QuickLink href="/team-dashboard/non-negotiables" label="Non-negotiables" emoji="✅" />
        <QuickLink href="/team-dashboard/my-tasks" label="My tasks" emoji="📋" />
        <QuickLink href="/team-dashboard/team-tasks" label="Team tasks" emoji="👥" />
        <QuickLink href="/team-dashboard/performance" label="Performance" emoji="📈" />
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, href, accent,
}: {
  label: string; value: string; sub: string; href: string; accent?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...CARD, cursor: 'pointer' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <p style={{ fontSize: 26, fontWeight: 800, color: accent ?? 'var(--text-1)', margin: '0 0 2px', lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{sub}</p>
      </div>
    </Link>
  )
}

function QuickLink({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        ...CARD,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', padding: '14px 16px',
      }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{label}</span>
      </div>
    </Link>
  )
}
