import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveUserId } from '@/lib/admin'
import { TASK_TYPE_STYLES } from '@/types'
import type { Task, Lead, Client, WeeklyCheckin, CheckinPrefill } from '@/types'
import Link from 'next/link'
import CheckinTrigger from '@/components/dashboard/CheckinTrigger'
import { getTranslations } from '@/lib/i18n'
import type { Translations } from '@/locales/en'

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

function greeting(t: Translations) {
  const h = new Date().getHours()
  if (h < 12) return t.dashboard.goodMorning
  if (h < 17) return t.dashboard.goodAfternoon
  return t.dashboard.goodEvening
}

function todayLabel(language: 'en' | 'no' = 'en') {
  const locale = language === 'no' ? 'nb-NO' : 'en-GB'
  return new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
}

function dayPassedThisWeek(checkinDay: number, todayDay: number): boolean {
  const toWeekOrd = (d: number) => d === 0 ? 7 : d // Sun=7, Mon=1, …, Sat=6
  return toWeekOrd(todayDay) > toWeekOrd(checkinDay)
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  statusColor = 'var(--text-3)',
  glass = false,
}: {
  label: string
  value: string
  sub?: string
  statusColor?: string
  glass?: boolean
}) {
  return (
    <div
      className="stat-card"
      style={{
        background: glass ? 'var(--bg-glass)' : 'var(--bg-surface)',
        backdropFilter: glass ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(12px)' : undefined,
        border: `1px solid ${glass ? 'var(--border-strong)' : 'var(--border)'}`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: 'var(--radius-card)',
        padding: '16px 18px',
        boxShadow: glass
          ? `var(--glow-indigo), inset 3px 0 12px ${statusColor}22`
          : `inset 3px 0 8px ${statusColor}18`,
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
    >
      <p className="label-caps" style={{ marginBottom: '8px' }}>{label}</p>
      <p className="hero-num" style={glass ? {
        background: 'linear-gradient(135deg, var(--neon-indigo), var(--neon-cyan))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      } : {}}>{value}</p>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{sub}</p>
      )}
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const style = TASK_TYPE_STYLES[task.type]
  const borderColor = task.priority === 'overdue' ? 'var(--neon-red)'
    : task.priority === 'today' ? 'var(--neon-amber)'
    : 'var(--border-strong)'
  const glowColor = task.priority === 'overdue' ? 'var(--glow-red)'
    : task.priority === 'today' ? 'var(--glow-amber)'
    : 'none'

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
        marginLeft: '-20px',
        boxShadow: glowColor,
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

// ─── Mini Revenue Chart ───────────────────────────────────────────────────────

function MiniRevenueChart({ history, currency, language }: { history: { month: string; cash_collected: number | null }[]; currency: string; language?: string }) {
  if (!history || history.length === 0) return null

  // Sort ascending (oldest → newest)
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month))
  const values = sorted.map(h => h.cash_collected ?? 0)
  const maxVal = Math.max(...values, 1)

  const chartH = 72
  const barW   = 28
  const gap    = 8
  const totalW = sorted.length * (barW + gap) - gap

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${totalW} ${chartH}`}
        preserveAspectRatio="none"
        style={{ height: '72px', display: 'block' }}
      >
        {sorted.map((h, i) => {
          const barH = Math.max((values[i] / maxVal) * chartH, 2)
          const x = i * (barW + gap)
          const y = chartH - barH
          const isLast = i === sorted.length - 1
          return (
            <rect
              key={h.month}
              x={x} y={y} width={barW} height={barH}
              rx="3"
              fill={isLast ? 'var(--neon-indigo)' : 'rgba(255,255,255,0.08)'}
            />
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {sorted.map((h, i) => {
          const [y, m] = h.month.split('-')
          const locale = language === 'no' ? 'nb-NO' : 'en-GB'
          const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(locale, { month: 'short' })
          const isLast = i === sorted.length - 1
          return (
            <div key={h.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: isLast ? 'var(--text-1)' : 'var(--text-3)', fontWeight: isLast ? 600 : 400 }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
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

function SectionCard({ title, href, seeAllLabel, children }: { title: string; href: string; seeAllLabel?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '20px',
        transition: 'border-color 120ms ease',
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
          {seeAllLabel ?? 'See all'} →
        </Link>
      </div>
      {children}
    </div>
  )
}

// ─── Week bounds ──────────────────────────────────────────────────────────────

function getWeekBounds(date: Date = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()
  const now = new Date()
  const monthStart = `${now.toISOString().slice(0, 7)}-01`
  const { weekStart, weekEnd } = getWeekBounds(now)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = nextMonth.toISOString().slice(0, 10)

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
    { data: pendingInstallmentsThisMonth },
    { data: thisWeekCheckin },
    { data: newLeadsThisWeek },
    { data: repliedThisWeek },
    { data: bookedThisWeek },
    { data: closedClientsThisWeek },
    { data: paidThisWeek },
    { data: newClientsThisWeek },
    { data: revenueHistory },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('completed', false)
      .in('priority', ['overdue', 'today'])
      .order('priority')
      .limit(5),
    supabase
      .from('clients')
      .select('id, started_at, payment_type, total_amount')
      .eq('user_id', uid)
      .eq('active', true),
    supabase
      .from('clients')
      .select('*')
      .eq('user_id', uid)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('leads')
      .select('ig_username, stage')
      .eq('user_id', uid)
      .not('stage', 'in', '("closed","bad_fit","not_interested")'),
    supabase.from('kpi_targets').select('*').eq('user_id', uid).single(),
    supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('user_id', uid)
      .eq('month', new Date().toISOString().slice(0, 7))
      .single(),
    supabase.from('leads').select('id').eq('user_id', uid).gte('created_at', monthStart),
    supabase.from('payment_installments').select('amount, clients!inner(user_id)')
      .eq('clients.user_id', user.id).eq('paid', true).gte('paid_at', monthStart),
    supabase.from('leads').select('id').eq('user_id', uid).eq('call_outcome', 'showed')
      .gte('updated_at', monthStart),
    supabase.from('payment_installments').select('amount, clients!inner(user_id)')
      .eq('clients.user_id', user.id).eq('paid', false)
      .gte('due_date', monthStart).lt('due_date', monthEnd),
    // Check-in data
    supabase.from('weekly_checkins').select('*').eq('user_id', uid).eq('week_start', weekStart).single(),
    supabase.from('leads').select('id').eq('user_id', uid).gte('created_at', weekStart),
    supabase.from('leads').select('id').eq('user_id', uid)
      .in('stage', ['replied', 'freebie_sent', 'call_booked', 'second_call', 'closed'])
      .gte('updated_at', weekStart),
    supabase.from('leads').select('id').eq('user_id', uid)
      .in('stage', ['call_booked', 'second_call', 'closed'])
      .gte('updated_at', weekStart),
    supabase.from('clients').select('id').eq('user_id', uid).gte('started_at', weekStart),
    supabase.from('payment_installments').select('amount, clients!inner(user_id)')
      .eq('clients.user_id', user.id).eq('paid', true).gte('paid_at', weekStart),
    supabase.from('clients').select('payment_type, total_amount, monthly_amount, plan_months')
      .eq('user_id', uid).gte('started_at', weekStart),
    supabase.from('monthly_snapshots').select('month, cash_collected')
      .eq('user_id', uid)
      .order('month', { ascending: false })
      .limit(6),
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
  const expectedThisMonth = (pendingInstallmentsThisMonth ?? []).reduce((s, i) => s + (i as { amount: number }).amount, 0)
  const callsHeld = snapshot?.calls_held ?? liveStats.calls_held
  const clientsSignedThisMonth = snapshot?.clients_signed
    ?? (allActiveClients ?? []).filter(c => (c as Client).started_at >= monthStart).length

  const cashTarget = targets?.cash_target ?? 0
  const revenueTarget = targets?.revenue_target ?? 0
  const activeClientCount = allActiveClients?.length ?? 0
  const clients = clientsForTable
  const currency = profile?.base_currency ?? 'NOK'
  const userLanguage = (profile?.language as 'en' | 'no' | undefined) ?? 'en'
  const t = getTranslations(userLanguage)
  const monthLocale = userLanguage === 'no' ? 'nb-NO' : 'en-US'
  const monthName = now.toLocaleString(monthLocale, { month: 'long' })
  const revenueChartTitle = userLanguage === 'no'
    ? `Inntekt — siste ${revenueHistory?.length ?? 0} måneder`
    : `Revenue — last ${revenueHistory?.length ?? 0} months`
  const numbersCardTitle = `${t.dashboard.numbersFor} ${monthName}`

  // ─── Check-in logic ─────────────────────────────────────────────────────────
  const checkinEnabled = (profile as Record<string, unknown>)?.checkin_enabled !== false
  const checkinDay = ((profile as Record<string, unknown>)?.checkin_day as number | null) ?? 0
  const todayDayOfWeek = now.getDay() // local time, 0=Sun
  const existingCheckin = thisWeekCheckin as WeeklyCheckin | null
  const alreadySubmitted = !!existingCheckin?.submitted_at
  const isSnoozed = !!(existingCheckin?.snoozed_until && new Date(existingCheckin.snoozed_until) > now)
  const checkinDue = checkinEnabled && !alreadySubmitted && !isSnoozed && (todayDayOfWeek === checkinDay)
  const checkinOverdue = checkinEnabled && !alreadySubmitted && !isSnoozed && dayPassedThisWeek(checkinDay, todayDayOfWeek)
  const canSnooze = !existingCheckin?.snoozed_until || new Date(existingCheckin.snoozed_until) <= now

  // Prefill computation for check-in
  const weekCashPaid = (paidThisWeek ?? []).reduce((s, i) => {
    const row = i as { amount: number }
    return s + row.amount
  }, 0)
  const weekNewClients = (newClientsThisWeek ?? []) as Array<{
    payment_type: string; total_amount: number; monthly_amount: number | null; plan_months: number | null
  }>
  const weekCashFromNew = weekNewClients.filter(c => c.payment_type !== 'plan').reduce((s, c) => s + c.total_amount, 0)
  const weekRevenue = weekNewClients.reduce((s, c) => {
    if (c.payment_type === 'plan' && c.monthly_amount && c.plan_months) return s + c.monthly_amount * c.plan_months
    return s + c.total_amount
  }, 0)

  const checkinPrefill: CheckinPrefill = {
    followersGained: (newLeadsThisWeek ?? []).length,
    repliesReceived: (repliedThisWeek ?? []).length,
    callsBooked: (bookedThisWeek ?? []).length,
    clientsClosed: (closedClientsThisWeek ?? []).length,
    cashCollected: weekCashPaid + weekCashFromNew,
    revenueContracted: weekRevenue,
  }

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
    { label: t.pipeline.follower, key: 'follower' },
    { label: t.pipeline.replied, key: 'replied' },
    { label: t.pipeline.freebieSent, key: 'freebie_sent' },
    { label: t.pipeline.callBooked, key: 'call_booked' },
    { label: t.dashboard.nurture, key: 'nurture' },
  ]

  // ─── Login streak ──────────────────────────────────────────────────────────
  const todayDate = now.toISOString().slice(0, 10)
  const lastActive = (profile as Record<string, unknown>)?.last_active_date as string | null | undefined
  const currentStreak = ((profile as Record<string, unknown>)?.login_streak as number | null) ?? 0

  let loginStreak = currentStreak
  if (lastActive !== todayDate) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    loginStreak = lastActive === yesterdayStr ? currentStreak + 1 : 1
    // Fire-and-forget — don't block render
    supabase.from('users')
      .update({ login_streak: loginStreak, last_active_date: todayDate })
      .eq('id', user.id)
      .then(() => {})
  }

  return (
    <div style={{ padding: '24px 24px 88px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Check-in trigger */}
      {(checkinDue || checkinOverdue) && (
        <CheckinTrigger
          initialDue={checkinDue || checkinOverdue}
          isOverdue={checkinOverdue && !checkinDue}
          checkin={existingCheckin}
          prefill={checkinPrefill}
          currency={currency}
          weekStart={weekStart}
          weekEnd={weekEnd}
          canSnooze={canSnooze}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, var(--text-1), var(--neon-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
          }}>
            {greeting(t)}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {loginStreak >= 2 && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#D97706',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius-badge)',
                padding: '4px 10px',
              }}
            >
              🔥 {loginStreak} {t.dashboard.dayStreak}
            </span>
          )}
          <span
            style={{
              fontSize: '13px',
              color: 'var(--text-2)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-badge)',
              padding: '4px 10px',
            }}
          >
            {todayLabel(userLanguage)}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div data-walkthrough="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '24px' }}
        className="md:grid-cols-4"
      >
        <StatCard
          label={t.numbers.cashCollected}
          value={formatCurrency(cashCollected, currency)}
          sub={cashTarget ? `Target: ${formatCurrency(cashTarget, currency)}` : undefined}
          statusColor={cashStatusColor}
          glass={true}
        />
        <StatCard
          label={t.dashboard.activeClients}
          value={String(activeClientCount)}
          statusColor="var(--neon-green)"
          glass={true}
        />
        <StatCard label={t.dashboard.callsThisMonth} value={String(callsHeld)} />
        <StatCard label={t.dashboard.clientsSigned} value={String(clientsSignedThisMonth)} sub={t.dashboard.thisMonth} statusColor="var(--neon-green)" />
      </div>

      {/* Mini revenue chart */}
      {revenueHistory && revenueHistory.length > 1 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '16px 20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <p className="label-caps">{revenueChartTitle}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>
              {formatCurrency(cashCollected, currency)} this month
            </p>
          </div>
          <MiniRevenueChart history={revenueHistory as { month: string; cash_collected: number | null }[]} currency={currency} language={userLanguage} />
        </div>
      )}

      {/* Tasks + Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}
        className="lg:grid-cols-2"
      >
        {/* Tasks */}
        <div data-walkthrough="dashboard-tasks">
          <SectionCard title={t.dashboard.doToday} href="/tasks" seeAllLabel={t.common.seeAll}>
            {(tasks?.length ?? 0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
                <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{t.dashboard.allCaughtUp}</p>
              </div>
            ) : (
              <div>
                {(tasks as Task[]).map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Revenue */}
        <SectionCard title={numbersCardTitle} href="/numbers" seeAllLabel={t.common.seeAll}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: t.dashboard.expectedThisMonth, value: expectedThisMonth, target: cashTarget, color: '#16A34A' },
              { label: t.dashboard.revenueContracted, value: revenueContracted, target: revenueTarget, color: 'var(--accent)' },
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
        <SectionCard title={t.dashboard.pipelineSnapshot} href="/pipeline" seeAllLabel={t.common.seeAll}>
          {(leads?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>{t.dashboard.noLeadsYet}</p>
              <Link
                href="/pipeline"
                style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
              >
                {t.dashboard.addFirstLead} →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', paddingRight: '16px' }}>
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
      <SectionCard title={t.dashboard.activeClients} href="/clients" seeAllLabel={t.common.seeAll}>
        {(clients?.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>{t.dashboard.noClientsYet}</p>
            <Link
              href="/clients"
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
            >
              {t.dashboard.addFirstClient} →
            </Link>
          </div>
        ) : (
          <div>
            {(clients as Client[]).map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderBottom: '1px solid var(--border)',
                  minHeight: '44px',
                  padding: '6px 0',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.12)',
                    color: 'var(--neon-indigo)',
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.full_name || c.ig_username}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                    @{c.ig_username}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span
                    className="badge"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    {c.payment_type === 'pif' ? 'PIF' : c.payment_type === 'split' ? 'Split' : 'Plan'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {c.monthly_amount ? formatCurrency(c.monthly_amount, currency) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
