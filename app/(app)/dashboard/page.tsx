import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { TASK_TYPE_STYLES } from '@/types'
import type { Task, Lead, Client } from '@/types'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  return days
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Task row (dashboard preview) ─────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const style = TASK_TYPE_STYLES[task.type]
  const dotColor = task.priority === 'overdue' ? 'bg-red-500' : 'bg-amber-400'

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
      </div>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: style.bg, color: style.text }}
      >
        {style.label}
      </span>
    </div>
  )
}

// ─── Revenue snapshot ─────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Pipeline snapshot column ─────────────────────────────────────────────────

function PipelineCol({
  label, count, leads, color,
}: {
  label: string; count: number; leads: string[]; color: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`rounded-xl p-3 h-full border ${color}`}>
        <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
        <p className="text-xl font-bold text-gray-900 mb-2">{count}</p>
        <div className="space-y-1">
          {leads.slice(0, 3).map((name, i) => (
            <p key={i} className="text-xs text-gray-500 truncate">@{name}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: profile },
    { data: tasks },
    { data: clients },
    { data: leads },
    { data: targets },
    { data: snapshots },
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
  ])

  const snapshot = snapshots
  const cashCollected = snapshot?.cash_collected ?? 0
  const cashTarget = targets?.cash_target ?? 0
  const activeClientCount = clients?.length ?? 0

  // Group leads by stage
  const stageGroups = (leads ?? []).reduce<Record<string, string[]>>((acc, l) => {
    if (!acc[l.stage]) acc[l.stage] = []
    acc[l.stage].push(l.ig_username)
    return acc
  }, {})

  const pipelineCols = [
    { label: 'Follower', key: 'follower', color: 'border-blue-100 bg-blue-50' },
    { label: 'Replied', key: 'replied', color: 'border-blue-100 bg-blue-50' },
    { label: 'Freebie sent', key: 'freebie_sent', color: 'border-gray-100 bg-white' },
    { label: 'Call booked', key: 'call_booked', color: 'border-gray-100 bg-white' },
    { label: 'Nurture', key: 'nurture', color: 'border-gray-100 bg-white' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">{todayLabel()}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Money in this month"
          value={formatCurrency(cashCollected, profile?.base_currency ?? 'NOK')}
          sub={cashTarget ? `Target: ${formatCurrency(cashTarget, profile?.base_currency ?? 'NOK')}` : undefined}
        />
        <StatCard label="Active clients" value={String(activeClientCount)} />
        <StatCard label="Calls this week" value={String(snapshot?.calls_held ?? 0)} />
        <StatCard label="New followers" value={String(snapshot?.new_followers ?? 0)} sub="this month" />
      </div>

      {/* Tasks + Revenue side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Do these today */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Do these today</h2>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-700 font-medium">See all →</Link>
          </div>
          {(tasks?.length ?? 0) === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div>
              {(tasks as Task[]).map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}
        </div>

        {/* Revenue snapshot */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Revenue this month</h2>
            <Link href="/numbers" className="text-sm text-blue-600 hover:text-blue-700 font-medium">See all →</Link>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Cash collected', value: cashCollected, target: cashTarget, color: 'bg-green-500' },
              { label: 'Revenue contracted', value: snapshot?.revenue_contracted ?? 0, target: targets?.revenue_target ?? 0, color: 'bg-blue-500' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(row.value, profile?.base_currency ?? 'NOK')}
                  </span>
                </div>
                <ProgressBar value={row.value} max={row.target} color={row.color} />
                {row.target > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Target: {formatCurrency(row.target, profile?.base_currency ?? 'NOK')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline snapshot */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Pipeline snapshot</h2>
          <Link href="/pipeline" className="text-sm text-blue-600 hover:text-blue-700 font-medium">See all →</Link>
        </div>
        {(leads?.length ?? 0) === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">No leads yet.</p>
            <Link href="/pipeline" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Add your first lead →
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pipelineCols.map(col => (
              <PipelineCol
                key={col.key}
                label={col.label}
                count={stageGroups[col.key]?.length ?? 0}
                leads={stageGroups[col.key] ?? []}
                color={col.color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Clients */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Active clients</h2>
          <Link href="/clients" className="text-sm text-blue-600 hover:text-blue-700 font-medium">See all →</Link>
        </div>
        {(clients?.length ?? 0) === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">No clients yet.</p>
            <Link href="/clients" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Add your first client →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left border-b border-gray-50">
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium">Payment</th>
                  <th className="pb-2 font-medium text-right">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {(clients as Client[]).map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium text-gray-900">{c.full_name || c.ig_username}</p>
                      <p className="text-xs text-gray-400">@{c.ig_username}</p>
                    </td>
                    <td className="py-2.5">
                      <span className="text-xs text-gray-500 capitalize">{c.payment_type}</span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-900">
                      {c.monthly_amount ? formatCurrency(c.monthly_amount, profile?.base_currency ?? 'NOK') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
