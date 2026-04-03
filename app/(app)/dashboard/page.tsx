import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { TASK_TYPE_STYLES } from '@/types'
import type { Task, Lead, Client } from '@/types'
import Link from 'next/link'

// ─── Live stats helper ────────────────────────────────────────────────────────

function computeLiveStats(
  allClients: Client[],
  monthStart: string,
  newLeadsCount: number,
  paidInstallmentsAmount: number,
  callsHeldCount: number,
) {
  const monthClients = allClients.filter(c => c.started_at >= monthStart)
  const cashFromNew = monthClients.filter(c => c.payment_type !== 'plan').reduce((s, c) => s + c.total_amount, 0)
  return {
    cash_collected: cashFromNew + paidInstallmentsAmount,
    revenue_contracted: monthClients.reduce((s, c) => s + c.total_amount, 0),
    new_followers: newLeadsCount,
    calls_held: callsHeldCount,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel() {
  return new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  statusColor = 'var(--text-3)',
}: {
  label: string
  value: string
  sub?: string
  statusColor?: string
}) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      <p className="label-caps" style={{ marginBottom: '8px' }}>{label}</p>
      <p className="hero-num">{value}</p>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{sub}</p>
      )}
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const style = TASK_TYPE_STYLES[task.type]
  const borderColor = task.priority === 'overdue' ? '#DC2626' : task.priority === 'today' ? '#D97706' : 'var(--border-strong)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`,
        paddingLeft: '12px',
        marginLeft: '-16px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </p>
        {task.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </p>
        )}
      </div>
      <span
        className="badge"
        style={{ background: style.bg, color: style.text, flexShrink: 0 }}
      >
        {style.label}
      </span>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ width: '100%', height: '3px', background: 'var(--surface-3)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: '99px', background: color, width: `${pct}%`, transition: 'width 400ms ease' }} />
    </div>
  )
}

// ─── Pipeline chip ────────────────────────────────────────────────────────────

function PipelineChip({ label, count, leads }: { label: string; count: number; leads: string[] }) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '10px 14px',
        minWidth: '120px',
      }}
    >
      <p className="label-caps" style={{ marginBottom: '6px' }}>{label}</p>
      <p className="hero-num" style={{ fontSize: '22px', marginBottom: '6px' }}>{count}</p>
      {leads.slice(0, 2).map((name, i) => (
        <p
          key={i}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          @{name}
        </p>
      ))}
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className="section-title">{title}</h2>
        <Link
          href={href}
          style={{
            fontSize: '13px',
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          See all →
        </Link>
      </div>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`

  const [
    { data: profile },
    { data: tasks },
    { data: allActiveClients },
    { data: clientsForTable },
    { data: leads },
    { data: targets },
    { data: snapshot },
    { data: newLeadsThisMonth },
    { data: paidInstallmentsThisMonth },
    { data: callsHeldThisMonth },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', false)
      .in('priority', ['overdue', 'today'])
      .order('priority')
      .limit(5),
    supabase
      .from('clients')
      .select('id, started_at, payment_type, total_amount')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('leads')
      .select('ig_username, stage')
      .eq('user_id', user.id)
      .not('stage', 'in', '("closed","bad_fit","not_interested")'),
    supabase.from('kpi_targets').select('*').eq('user_id', user.id).single(),
    supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', new Date().toISOString().slice(0, 7))
      .single(),
    supabase.from('leads').select('id').eq('user_id', user.id).gte('created_at', monthStart),
    supabase.from('payment_installments').select('amount, clients!inner(user_id)')
      .eq('clients.user_id', user.id).eq('paid', true).gte('paid_at', monthStart),
    supabase.from('leads').select('id').eq('user_id', user.id).eq('call_outcome', 'showed')
      .gte('updated_at', monthStart),
  ])

  const liveStats = computeLiveStats(
    (allActiveClients as Client[]) ?? [],
    monthStart,
    (newLeadsThisMonth ?? []).length,
    (paidInstallmentsThisMonth ?? []).reduce((s, i) => s + (i as { amount: number }).amount, 0),
    (callsHeldThisMonth ?? []).length,
  )
  const cashCollected = snapshot?.cash_collected ?? liveStats.cash_collected
  const revenueContracted = snapshot?.revenue_contracted ?? liveStats.revenue_contracted
  const newFollowers = snapshot?.new_followers ?? liveStats.new_followers
  const callsHeld = snapshot?.calls_held ?? liveStats.calls_held

  const cashTarget = targets?.cash_target ?? 0
  const revenueTarget = targets?.revenue_target ?? 0
  const activeClientCount = allActiveClients?.length ?? 0
  const clients = clientsForTable
  const currency = profile?.base_currency ?? 'NOK'

  const cashPct = cashTarget > 0 ? (cashCollected / cashTarget) * 100 : null
  const cashStatusColor = cashPct === null ? 'var(--text-3)'
    : cashPct >= 100 ? '#16A34A'
    : cashPct >= 70 ? '#D97706'
    : '#DC2626'

  const stageGroups = (leads ?? []).reduce<Record<string, string[]>>((acc, l) => {
    if (!acc[l.stage]) acc[l.stage] = []
    acc[l.stage].push(l.ig_username)
    return acc
  }, {})

  const pipelineCols = [
    { label: 'Follower', key: 'follower' },
    { label: 'Replied', key: 'replied' },
    { label: 'Freebie', key: 'freebie_sent' },
    { label: 'Call booked', key: 'call_booked' },
    { label: 'Nurture', key: 'nurture' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 className="page-title">
            {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text-2)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-badge)',
            padding: '4px 10px',
          }}
        >
          {todayLabel()}
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}
        className="lg:grid-cols-4"
      >
        <StatCard
          label="Money in this month"
          value={formatCurrency(cashCollected, currency)}
          sub={cashTarget ? `Target: ${formatCurrency(cashTarget, currency)}` : undefined}
          statusColor={cashStatusColor}
        />
        <StatCard
          label="Active clients"
          value={String(activeClientCount)}
          statusColor="#16A34A"
        />
        <StatCard label="Calls this month" value={String(callsHeld)} />
        <StatCard label="New followers" value={String(newFollowers)} sub="this month" />
      </div>

      {/* Tasks + Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}
        className="lg:grid-cols-2"
      >
        {/* Tasks */}
        <SectionCard title="Do these today" href="/tasks">
          {(tasks?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
              <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>You&apos;re all caught up!</p>
            </div>
          ) : (
            <div>
              {(tasks as Task[]).map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}
        </SectionCard>

        {/* Revenue */}
        <SectionCard title="Revenue this month" href="/numbers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Cash collected', value: cashCollected, target: cashTarget, color: '#16A34A' },
              { label: 'Revenue contracted', value: revenueContracted, target: revenueTarget, color: 'var(--accent)' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{row.label}</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(row.value, currency)}
                  </span>
                </div>
                <ProgressBar value={row.value} max={row.target} color={row.color} />
                {row.target > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                    Target: {formatCurrency(row.target, currency)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Pipeline snapshot */}
      <div style={{ marginBottom: '16px' }}>
        <SectionCard title="Pipeline snapshot" href="/pipeline">
          {(leads?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>No leads yet.</p>
              <Link
                href="/pipeline"
                style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
              >
                Add your first lead →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {pipelineCols.map(col => (
                <PipelineChip
                  key={col.key}
                  label={col.label}
                  count={stageGroups[col.key]?.length ?? 0}
                  leads={stageGroups[col.key] ?? []}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Clients */}
      <SectionCard title="Active clients" href="/clients">
        {(clients?.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>No clients yet.</p>
            <Link
              href="/clients"
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
            >
              Add your first client →
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Client', 'Payment', 'Monthly'].map((h, i) => (
                    <th
                      key={h}
                      className="label-caps"
                      style={{
                        padding: '0 0 10px',
                        textAlign: i === 2 ? 'right' : 'left',
                        borderBottom: '1px solid var(--border)',
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(clients as Client[]).map(c => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '10px 16px 10px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'rgba(37,99,235,0.12)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {(c.full_name || c.ig_username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 500, color: 'var(--text-1)' }}>{c.full_name || c.ig_username}</p>
                          <p
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-3)',
                            }}
                          >
                            @{c.ig_username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px 10px 0' }}>
                      <span
                        className="badge"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                      >
                        {c.payment_type === 'pif' ? 'Paid in full' : c.payment_type === 'split' ? 'Split' : `Plan`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 500, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {c.monthly_amount ? formatCurrency(c.monthly_amount, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
