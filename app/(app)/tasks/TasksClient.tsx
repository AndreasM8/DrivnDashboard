'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task, TaskType, TaskPriority } from '@/types'
import type { NonNegotiable, NonNegotiableCompletion, PowerTask } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_STYLES = {
  nonneg:   { border: '#F59E0B', bg: 'rgba(245,158,11,0.04)',  title: 'Non-Negotiables' },
  business: { border: '#6366F1', bg: 'rgba(99,102,241,0.04)', title: 'Business Powerlist' },
  personal: { border: '#10B981', bg: 'rgba(16,185,129,0.04)', title: 'Personal' },
  followups:{ border: '#EF4444', bg: 'rgba(239,68,68,0.03)',  title: 'Follow-ups' },
} as const

const BUSINESS_CATS = [
  { key: 'product'    as const, label: 'Product & Delivery',      placeholders: ['Optimise onboarding sequence', 'Review client check-in process', 'Update program materials'] },
  { key: 'content'    as const, label: 'Content & Freebies',      placeholders: ['Create new freebie — meal plan template', 'Film 3 reels for next week', 'Write email to nurture list'] },
  { key: 'operations' as const, label: 'Business Operations',     placeholders: ['Review ad spend and ROAS', 'Team EOD report review', 'Send invoices'] },
]

const WEEKLY_QUOTES: Record<number, string> = {
  0: 'Prepare tomorrow today.',
  1: 'Set the tone for the week. Attack the list.',
  2: 'Consistency beats motivation every time.',
  3: 'Halfway there. Don\'t let up.',
  4: 'One more push before the weekend.',
  5: 'Finish strong. The weekend is earned.',
  6: 'Use the quiet time to build.',
}

const PRIORITY_ORDER: TaskPriority[] = ['overdue', 'today', 'this_week', 'upcoming']
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  overdue: 'Overdue', today: 'Today', this_week: 'This week', upcoming: 'Coming up',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${g}, ${name}` : g
}

function fmtDate() {
  return new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtDue(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  const diff = Math.round((date.getTime() - Date.now()) / 86400000)
  if (diff < -1) return `${Math.abs(diff)}d ago`
  if (diff === -1) return 'Yesterday'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function daysSince(d: string | null) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOW_FULL   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDays(days: number[] | null): string {
  if (!days || days.length === 7) return 'Every day'
  if (days.length === 0) return 'No days'
  return days.sort((a,b)=>a-b).map(d => DOW_FULL[d]).join(', ')
}

function isCompletedInCycle(task: PowerTask, cycleStart: Date): boolean {
  if (!task.completed || !task.completed_at) return false
  return new Date(task.completed_at) >= cycleStart
}

// ─── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  section, title, count, badge, defaultOpen, children,
}: {
  section: keyof typeof SECTION_STYLES
  title: string
  count?: number
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const s = SECTION_STYLES[section]
  const [open, setOpen] = useState(defaultOpen === true)

  return (
    <div style={{
      background: open ? s.bg : 'var(--surface-1)',
      border: `1px solid ${open ? s.border + '33' : 'var(--border)'}`,
      borderTop: `3px solid ${s.border}`,
      borderRadius: '12px',
      boxShadow: open ? '0 2px 8px rgba(0,0,0,0.06)' : 'var(--shadow-card)',
      overflow: 'hidden',
      transition: 'background 200ms ease, box-shadow 200ms ease',
    }}>
      {/* Header — always clickable */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: open ? '14px 18px 12px' : '11px 18px',
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', userSelect: 'none',
          transition: 'padding 200ms ease',
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: s.border, margin: 0, flex: 1, letterSpacing: '-0.01em' }}>{title}</h2>

        {/* Summary chips — always visible */}
        {count !== undefined && (
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
            background: `${s.border}18`, color: s.border,
          }}>
            {count}
          </span>
        )}
        {badge && (
          <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{badge}</span>
        )}

        {/* Chevron */}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"
          style={{ color: 'var(--text-3)', flexShrink: 0, transition: 'transform 220ms ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
        </svg>
      </div>

      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  )
}

// ─── Custom checkbox ───────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, color }: { checked: boolean; onChange: () => void; color: string }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '20px', height: '20px', minWidth: '20px',
        borderRadius: '4px',
        border: checked ? 'none' : `1.5px solid ${color}66`,
        background: checked ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        transition: 'all 150ms ease', flexShrink: 0,
      }}
    >
      {checked && (
        <svg viewBox="0 0 10 8" fill="none" width="11" height="11">
          <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
        </svg>
      )}
    </button>
  )
}

// ─── Add task inline input ─────────────────────────────────────────────────────

function AddInline({ placeholder, color, onAdd }: { placeholder: string; color: string; onAdd: (title: string) => Promise<void> }) {
  const [val, setVal] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    const t = val.trim()
    if (!t) return
    setLoading(true)
    await onAdd(t)
    setVal('')
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      border: `1.5px dashed ${color}44`, borderRadius: '8px',
      padding: '8px 12px', marginTop: '8px',
    }}>
      <span style={{ color: `${color}88`, fontSize: '14px', userSelect: 'none' }}>+</span>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={loading}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', background: 'transparent', outline: 'none',
          fontSize: '13px', color: 'var(--text-1)',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  )
}

// ─── Reset hour helpers ────────────────────────────────────────────────────────

function fmtHour(h: number) {
  if (h === 0)  return '12:00 AM (midnight)'
  if (h === 12) return '12:00 PM (noon)'
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
}

// ─── Non-Negotiables item row ─────────────────────────────────────────────────

function NonNegItemRow({ item, checked, color, onToggle, onDelete, onUpdateDays }: {
  item: NonNegotiable
  checked: boolean
  color: string
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateDays: (id: string, days: number[] | null) => Promise<void>
}) {
  const [showDays, setShowDays] = useState(false)

  function toggleDay(dow: number) {
    const current = item.days_of_week ?? [0,1,2,3,4,5,6]
    const next = current.includes(dow)
      ? current.filter(d => d !== dow)
      : [...current, dow]
    // If all 7 selected, treat as "every day" (null)
    const normalised = next.length === 7 ? null : next.length === 0 ? [dow] : next
    void onUpdateDays(item.id, normalised)
  }

  const hasSchedule = item.days_of_week != null && item.days_of_week.length < 7

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '32px' }}>
        <Checkbox checked={checked} onChange={() => onToggle(item.id, !checked)} color={color} />
        <span style={{
          flex: 1, fontSize: '14px',
          color: checked ? 'var(--text-3)' : 'var(--text-1)',
          textDecoration: checked ? 'line-through' : 'none',
          transition: 'all 200ms ease',
        }}>
          {item.title}
        </span>
        {/* Day schedule indicator — shows if not every day */}
        {hasSchedule && (
          <span style={{ fontSize: '10px', color: `${color}99`, fontWeight: 500 }}>
            {fmtDays(item.days_of_week)}
          </span>
        )}
        {/* Calendar toggle */}
        <button
          onClick={() => setShowDays(v => !v)}
          title="Set which days this appears"
          style={{
            color: showDays ? color : 'var(--text-3)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 4px', lineHeight: 1, opacity: showDays ? 1 : 0.5,
            transition: 'all 120ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = showDays ? '1' : '0.5')}
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
            <rect x="1" y="2" width="12" height="11" rx="2" />
            <path strokeLinecap="round" d="M1 6h12M5 1v2M9 1v2" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(item.id)}
          style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '16px', lineHeight: 1, opacity: 0.5 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        >×</button>
      </div>

      {/* Day picker (expandable) */}
      {showDays && (
        <div style={{ marginLeft: '30px', marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap', paddingBottom: '4px' }}>
          {DOW_LABELS.map((label, dow) => {
            const active = !item.days_of_week || item.days_of_week.includes(dow)
            return (
              <button
                key={dow}
                onClick={() => toggleDay(dow)}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${active ? color : 'var(--border-strong)'}`,
                  background: active ? color : 'transparent',
                  color: active ? '#fff' : 'var(--text-3)',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
              </button>
            )
          })}
          <span style={{ fontSize: '11px', color: 'var(--text-3)', alignSelf: 'center', marginLeft: '4px' }}>
            {fmtDays(item.days_of_week)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Non-Negotiables section ───────────────────────────────────────────────────

function NonNegSection({
  items, completions, followupTarget, followupsDoneToday, resetHour, todayDow,
  onToggle, onAdd, onDelete, onUpdateTarget, onUpdateResetHour, onUpdateDays,
}: {
  items: NonNegotiable[]
  completions: NonNegotiableCompletion[]
  followupTarget: number
  followupsDoneToday: number
  resetHour: number
  todayDow: number
  onToggle: (id: string, completed: boolean) => Promise<void>
  onAdd: (title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateTarget: (t: number) => Promise<void>
  onUpdateResetHour: (h: number) => Promise<void>
  onUpdateDays: (id: string, days: number[] | null) => Promise<void>
}) {
  const color = SECTION_STYLES.nonneg.border
  const completedSet = new Set(completions.filter(c => c.completed).map(c => c.non_negotiable_id))
  const visibleItems = items.filter(item => !item.days_of_week || item.days_of_week.includes(todayDow))
  const done = visibleItems.filter(i => completedSet.has(i.id)).length
  const total = visibleItems.length
  const pct = total > 0 ? (done / total) * 100 : 0

  return (
    <SectionCard section="nonneg" title="Non-Negotiables" badge={`${done} / ${total} today`} defaultOpen>
      {/* Progress bar */}
      <div style={{ height: '4px', borderRadius: '2px', background: `${color}22`, marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 300ms ease' }} />
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items
          .filter(item => !item.days_of_week || item.days_of_week.includes(todayDow))
          .map(item => {
            const checked = completedSet.has(item.id)
            return (
              <NonNegItemRow
                key={item.id}
                item={item}
                checked={checked}
                color={color}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdateDays={onUpdateDays}
              />
            )
          })
        }
      </div>

      <AddInline placeholder="Add a non-negotiable…" color={color} onAdd={onAdd} />

      {/* Follow-up goal widget */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${color}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-2)', flex: 1 }}>Follow-up goal today</span>
          <input
            type="number"
            min="0" max="99"
            value={followupTarget}
            onChange={e => onUpdateTarget(Number(e.target.value))}
            style={{
              width: '48px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
              border: `1.5px solid ${color}44`, borderRadius: '6px', padding: '3px 4px',
              background: 'transparent', color: 'var(--text-1)', outline: 'none',
            }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>DMs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: `${color}22`, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${followupTarget > 0 ? Math.min((followupsDoneToday / followupTarget) * 100, 100) : 0}%`,
              background: color, borderRadius: '2px', transition: 'width 300ms ease',
            }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {followupsDoneToday} / {followupTarget} done
          </span>
        </div>
      </div>

      {/* Reset time picker */}
      <div style={{
        marginTop: '14px', paddingTop: '14px',
        borderTop: `1px solid ${color}15`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ color: `${color}99`, flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6" />
          <path strokeLinecap="round" d="M8 5v3l2 1.5" />
        </svg>
        <span style={{ fontSize: '12px', color: 'var(--text-3)', flex: 1 }}>Resets daily at</span>
        <select
          value={resetHour}
          onChange={e => onUpdateResetHour(Number(e.target.value))}
          style={{
            fontSize: '12px', fontWeight: 500, color: color,
            background: `${color}10`, border: `1px solid ${color}33`,
            borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', outline: 'none',
          }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>{fmtHour(h)}</option>
          ))}
        </select>
      </div>
    </SectionCard>
  )
}

// ─── Business powerlist section ────────────────────────────────────────────────

function BusinessSection({
  tasks, cycleStart, onAdd, onComplete, onDelete, onSetRecurrence,
}: {
  tasks: PowerTask[]
  cycleStart: Date
  onAdd: (title: string, category: 'product' | 'content' | 'operations') => Promise<void>
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetRecurrence: (id: string, recurrence: 'daily' | 'weekly' | null, days?: number[]) => Promise<void>
}) {
  const color = SECTION_STYLES.business.border
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ product: true, content: true, operations: true })
  const activeCount = tasks.length

  return (
    <SectionCard section="business" title="Business Powerlist" count={activeCount}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BUSINESS_CATS.map(cat => {
          const catTasks = tasks.filter(t => t.category === cat.key)
          const isOpen = openCats[cat.key] !== false

          return (
            <div key={cat.key} style={{ borderRadius: '8px', border: `1px solid ${color}22`, overflow: 'hidden' }}>
              {/* Sub-category header */}
              <div
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: `${color}08` }}
                onClick={() => setOpenCats(v => ({ ...v, [cat.key]: !isOpen }))}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color, flex: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cat.label}
                </span>
                {catTasks.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px', background: `${color}22`, color }}>
                    {catTasks.length}
                  </span>
                )}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"
                  style={{ color: 'var(--text-3)', transition: 'transform 200ms', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
                </svg>
              </div>

              {isOpen && (
                <div style={{ padding: '10px 14px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {catTasks.map(task => (
                      <PowerTaskRow key={task.id} task={task} color={color} cycleStart={cycleStart} onComplete={onComplete} onDelete={onDelete} onSetRecurrence={onSetRecurrence} />
                    ))}
                    {catTasks.length === 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', padding: '2px 0' }}>
                        {cat.placeholders[0]}…
                      </p>
                    )}
                  </div>
                  <AddInline placeholder="+ Add a task…" color={color} onAdd={t => onAdd(t, cat.key)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─── Power task row ────────────────────────────────────────────────────────────

function PowerTaskRow({
  task, color, cycleStart, onComplete, onDelete, onSetRecurrence,
}: {
  task: PowerTask
  color: string
  cycleStart: Date
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetRecurrence: (id: string, recurrence: 'daily' | 'weekly' | null, days?: number[]) => Promise<void>
}) {
  const [showRecDays, setShowRecDays] = useState(false)
  const completedThisCycle = isCompletedInCycle(task, cycleStart)
  // For recurring tasks completed before this cycle: treat as uncompleted
  const showAsCompleted = task.completed && completedThisCycle

  function cycleRecurrence() {
    if (!task.recurrence) {
      void onSetRecurrence(task.id, 'daily')
    } else if (task.recurrence === 'daily') {
      void onSetRecurrence(task.id, 'weekly', task.recurrence_days ?? [])
      setShowRecDays(true)
    } else {
      void onSetRecurrence(task.id, null)
      setShowRecDays(false)
    }
  }

  function toggleRecDay(dow: number) {
    const current = task.recurrence_days ?? []
    const next = current.includes(dow) ? current.filter(d => d !== dow) : [...current, dow]
    void onSetRecurrence(task.id, 'weekly', next.length === 0 ? [dow] : next)
  }

  const recIcon = !task.recurrence ? null : task.recurrence === 'daily' ? '↻ Daily' : `↻ ${fmtDays(task.recurrence_days)}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px' }}>
        <Checkbox
          checked={showAsCompleted}
          onChange={() => { if (!showAsCompleted) void onComplete(task.id) }}
          color={color}
        />
        <span style={{
          flex: 1, fontSize: '13px',
          color: showAsCompleted ? 'var(--text-3)' : 'var(--text-1)',
          textDecoration: showAsCompleted ? 'line-through' : 'none',
          transition: 'all 200ms',
        }}>
          {task.title}
        </span>
        {task.due_date && !showAsCompleted && (
          <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtDue(task.due_date)}</span>
        )}
        {/* Recurrence badge / toggle */}
        <button
          onClick={cycleRecurrence}
          title={!task.recurrence ? 'Set recurrence' : task.recurrence === 'daily' ? 'Daily — click for weekly' : 'Weekly — click to remove'}
          style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', cursor: 'pointer',
            border: `1px solid ${task.recurrence ? color + '44' : 'var(--border)'}`,
            background: task.recurrence ? color + '15' : 'transparent',
            color: task.recurrence ? color : 'var(--text-3)',
            transition: 'all 120ms', whiteSpace: 'nowrap',
          }}
        >
          {recIcon ?? '↻'}
        </button>
        <button
          onClick={() => onDelete(task.id)}
          style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '16px', lineHeight: 1, opacity: 0.5 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        >×</button>
      </div>

      {/* Weekly day picker */}
      {task.recurrence === 'weekly' && showRecDays && (
        <div style={{ marginLeft: '28px', marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap', paddingBottom: '4px' }}>
          {DOW_LABELS.map((label, dow) => {
            const active = !task.recurrence_days || task.recurrence_days.includes(dow)
            return (
              <button
                key={dow}
                onClick={() => toggleRecDay(dow)}
                style={{
                  width: '24px', height: '24px', borderRadius: '50%', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${active ? color : 'var(--border-strong)'}`,
                  background: active ? color : 'transparent',
                  color: active ? '#fff' : 'var(--text-3)',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Personal section ──────────────────────────────────────────────────────────

function PersonalSection({ tasks, cycleStart, onAdd, onComplete, onDelete, onSetRecurrence }: {
  tasks: PowerTask[]
  cycleStart: Date
  onAdd: (title: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetRecurrence: (id: string, recurrence: 'daily' | 'weekly' | null, days?: number[]) => Promise<void>
}) {
  const color = SECTION_STYLES.personal.border

  return (
    <SectionCard section="personal" title="Personal" count={tasks.length}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>Book dentist appointment…</p>
        )}
        {tasks.map(task => (
          <PowerTaskRow key={task.id} task={task} color={color} cycleStart={cycleStart} onComplete={onComplete} onDelete={onDelete} onSetRecurrence={onSetRecurrence} />
        ))}
      </div>
      <AddInline placeholder="Add a personal task…" color={color} onAdd={onAdd} />
    </SectionCard>
  )
}

// ─── Follow-ups section ────────────────────────────────────────────────────────

function FollowupsSection({
  tasks, onComplete, onRefresh, refreshing,
}: {
  tasks: Task[]
  onComplete: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
  refreshing: boolean
}) {
  const color = SECTION_STYLES.followups.border
  const overdueCount = tasks.filter(t => t.priority === 'overdue').length
  const todayCount = tasks.filter(t => t.priority === 'today').length
  const needsAttention = overdueCount + todayCount

  return (
    <SectionCard
      section="followups"
      title="Follow-ups"
      count={tasks.length}
      badge={needsAttention > 0 ? `${needsAttention} need attention` : undefined}
    >
      {/* Refresh button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', marginTop: '-4px' }}>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            fontSize: '11px', color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-btn)', padding: '4px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="11" height="11"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 8a6 6 0 1110.5-4.5M12 3.5V7h-3.5" />
          </svg>
          Refresh
        </button>
      </div>

      {tasks.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
          No open follow-ups — great work!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {PRIORITY_ORDER.map(priority => {
            const group = tasks.filter(t => t.priority === priority)
            if (group.length === 0) return null
            const groupColor = priority === 'overdue' ? 'var(--danger)' : priority === 'today' ? 'var(--warning)' : 'var(--text-3)'
            return (
              <div key={priority}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: groupColor }}>
                    {PRIORITY_LABEL[priority]}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px',
                    background: priority === 'overdue' ? 'rgba(220,38,38,0.1)' : priority === 'today' ? 'rgba(217,119,6,0.1)' : 'var(--surface-3)',
                    color: groupColor }}>
                    {group.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {group.map(task => <FollowupRow key={task.id} task={task} onComplete={onComplete} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Follow-up task row ────────────────────────────────────────────────────────

function FollowupRow({ task, onComplete }: { task: Task; onComplete: (id: string) => Promise<void> }) {
  const [fading, setFading] = useState(false)
  const isOverdue = task.priority === 'overdue'
  const usernameMatch = task.title.match(/@([\w.]+)/)
  const username = usernameMatch?.[1] ?? null
  const borderColor = isOverdue ? 'var(--danger)' : task.priority === 'today' ? 'var(--warning)' : 'var(--border-strong)'

  async function handleComplete() {
    setFading(true)
    await onComplete(task.id)
  }

  return (
    <div
      className={fading ? 'task-fade-out' : ''}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Round checkbox (matches original style) */}
      <button
        onClick={handleComplete}
        style={{
          width: '18px', height: '18px', borderRadius: '50%',
          border: `1.5px solid ${borderColor}`, background: 'transparent',
          flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 120ms ease', padding: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = borderColor; (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </p>
          {username && (
            <a href="/pipeline" onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: 'var(--radius-badge)', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', textDecoration: 'none' }}>
              @{username}
            </a>
          )}
        </div>
        {task.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {task.description}
          </p>
        )}
      </div>

      <span style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text-3)', fontWeight: isOverdue ? 600 : 400, flexShrink: 0 }}>
        {fmtDue(task.due_at)}
      </span>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function TasksClient({
  userId, userName, dailyFollowupTarget, resetHour: initialResetHour, todayKey,
  cycleStartIso, todayDow,
  initialNonNeg, initialCompletions, initialPowerTasks, initialTasks, followupsCompletedToday,
}: {
  userId: string
  userName: string
  dailyFollowupTarget: number
  resetHour: number
  todayKey: string
  cycleStartIso: string
  todayDow: number
  initialNonNeg: NonNegotiable[]
  initialCompletions: NonNegotiableCompletion[]
  initialPowerTasks: PowerTask[]
  initialTasks: Task[]
  followupsCompletedToday: number
}) {
  const [nonNeg, setNonNeg]             = useState(initialNonNeg)
  const [completions, setCompletions]   = useState(initialCompletions)
  const [powerTasks, setPowerTasks]     = useState(initialPowerTasks)
  const [tasks, setTasks]               = useState(initialTasks)
  const [followupTarget, setFollowupTarget] = useState(dailyFollowupTarget)
  const [resetHour, setResetHour]       = useState(initialResetHour)
  const [followupsDone, setFollowupsDone]   = useState(followupsCompletedToday)
  const [refreshing, setRefreshing]     = useState(false)
  const targetDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef(createClient())

  const cycleStart = new Date(cycleStartIso)

  const businessTasks = powerTasks.filter(t => {
    if (t.category === 'personal') return false
    if (t.recurrence === 'weekly' && t.recurrence_days && !t.recurrence_days.includes(todayDow)) return false
    return true
  })
  const personalTasks = powerTasks.filter(t => {
    if (t.category !== 'personal') return false
    if (t.recurrence === 'weekly' && t.recurrence_days && !t.recurrence_days.includes(todayDow)) return false
    return true
  })

  // Status chips for header
  const nonNegDone = completions.filter(c => c.completed).length
  const overdueFollowups = tasks.filter(t => t.priority === 'overdue' || t.priority === 'today').length

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleNonNeg = useCallback(async (id: string, completed: boolean) => {
    // Optimistic update
    setCompletions(prev => {
      const existing = prev.find(c => c.non_negotiable_id === id)
      if (existing) return prev.map(c => c.non_negotiable_id === id ? { ...c, completed } : c)
      return [...prev, { id: crypto.randomUUID(), user_id: userId, non_negotiable_id: id, date: todayKey, completed, completed_at: completed ? new Date().toISOString() : null }]
    })
    await fetch(`/api/non-negotiables/${id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed, date: todayKey }),
    })
  }, [userId, todayKey])

  const addNonNeg = useCallback(async (title: string) => {
    const res = await fetch('/api/non-negotiables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, position: nonNeg.length }),
    })
    const json = await res.json() as { item: NonNegotiable }
    if (json.item) setNonNeg(prev => [...prev, json.item])
  }, [nonNeg.length])

  const deleteNonNeg = useCallback(async (id: string) => {
    setNonNeg(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/non-negotiables/${id}`, { method: 'DELETE' })
  }, [])

  const addPowerTask = useCallback(async (title: string, category: 'product' | 'content' | 'operations') => {
    const res = await fetch('/api/power-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, position: powerTasks.filter(t => t.category === category).length }),
    })
    const json = await res.json() as { task: PowerTask }
    if (json.task) setPowerTasks(prev => [...prev, json.task])
  }, [powerTasks])

  const addPersonalTask = useCallback(async (title: string) => {
    const res = await fetch('/api/power-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category: 'personal', position: personalTasks.length }),
    })
    const json = await res.json() as { task: PowerTask }
    if (json.task) setPowerTasks(prev => [...prev, json.task])
  }, [personalTasks.length])

  const completePowerTask = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    setPowerTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completed_at: now } : t))
    await fetch(`/api/power-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true, completed_at: now }),
    })
  }, [])

  const deletePowerTask = useCallback(async (id: string) => {
    setPowerTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/power-tasks/${id}`, { method: 'DELETE' })
  }, [])

  const setRecurrence = useCallback(async (id: string, recurrence: 'daily' | 'weekly' | null, days?: number[]) => {
    setPowerTasks(prev => prev.map(t => t.id === id
      ? { ...t, recurrence, recurrence_days: days !== undefined ? days : t.recurrence_days }
      : t
    ))
    await fetch(`/api/power-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurrence, ...(days !== undefined ? { recurrence_days: days } : {}) }),
    })
  }, [])

  const updateNonNegDays = useCallback(async (id: string, days: number[] | null) => {
    setNonNeg(prev => prev.map(i => i.id === id ? { ...i, days_of_week: days } : i))
    await fetch(`/api/non-negotiables/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days_of_week: days }),
    })
  }, [])

  const completeFollowup = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (task?.type === 'follow_up') setFollowupsDone(n => n + 1)
    await supabaseRef.current.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
  }, [tasks])

  const refreshTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetch('/api/tasks/generate', { method: 'POST' })
      const { data } = await supabaseRef.current.from('tasks').select('*').eq('user_id', userId).eq('completed', false).order('due_at')
      if (data) setTasks(data as Task[])
    } finally {
      setRefreshing(false)
    }
  }, [userId])

  const updateFollowupTarget = useCallback(async (t: number) => {
    setFollowupTarget(t)
    if (targetDebounce.current) clearTimeout(targetDebounce.current)
    targetDebounce.current = setTimeout(() => {
      void fetch('/api/user/followup-target', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t }),
      })
    }, 800)
  }, [])

  const updateResetHour = useCallback(async (h: number) => {
    setResetHour(h)
    if (resetDebounce.current) clearTimeout(resetDebounce.current)
    resetDebounce.current = setTimeout(() => {
      void fetch('/api/user/nonneg-reset-hour', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: h }),
      })
    }, 600)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  const quote = WEEKLY_QUOTES[new Date().getDay()]

  // Suppress unused import warnings — TaskType is used in types/index.ts imports
  void (undefined as unknown as TaskType)

  return (
    <div style={{ padding: '16px 16px 100px', maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{greeting(userName)}</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{fmtDate()}</span>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[
            { label: `${nonNegDone}/${nonNeg.length} non-neg`, color: '#F59E0B' },
            { label: `${overdueFollowups} follow-ups`, color: overdueFollowups > 0 ? '#EF4444' : '#10B981' },
            { label: `${businessTasks.length} powerlist`, color: '#6366F1' },
          ].map(chip => (
            <span key={chip.label} style={{
              fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '20px',
              background: `${chip.color}15`, color: chip.color, border: `1px solid ${chip.color}30`,
            }}>{chip.label}</span>
          ))}
        </div>

        {/* Daily quote */}
        <p style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', margin: 0 }}>{quote}</p>
      </div>

      {/* ── Section 1: Non-Negotiables ────────────────────────────────────── */}
      <NonNegSection
        items={nonNeg}
        completions={completions}
        followupTarget={followupTarget}
        followupsDoneToday={followupsDone}
        resetHour={resetHour}
        todayDow={todayDow}
        onToggle={toggleNonNeg}
        onAdd={addNonNeg}
        onDelete={deleteNonNeg}
        onUpdateTarget={updateFollowupTarget}
        onUpdateResetHour={updateResetHour}
        onUpdateDays={updateNonNegDays}
      />

      {/* ── Section 2: Business Powerlist ────────────────────────────────── */}
      <BusinessSection
        tasks={businessTasks}
        cycleStart={cycleStart}
        onAdd={addPowerTask}
        onComplete={completePowerTask}
        onDelete={deletePowerTask}
        onSetRecurrence={setRecurrence}
      />

      {/* ── Section 3: Personal ──────────────────────────────────────────── */}
      <PersonalSection
        tasks={personalTasks}
        cycleStart={cycleStart}
        onAdd={addPersonalTask}
        onComplete={completePowerTask}
        onDelete={deletePowerTask}
        onSetRecurrence={setRecurrence}
      />

      {/* ── Section 4: Follow-ups ─────────────────────────────────────────── */}
      <FollowupsSection
        tasks={tasks}
        onComplete={completeFollowup}
        onRefresh={refreshTasks}
        refreshing={refreshing}
      />

    </div>
  )
}
