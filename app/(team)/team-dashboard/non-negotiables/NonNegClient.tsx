'use client'

import { useState } from 'react'
import type { TeamNonNeg } from '@/types'

interface Props {
  nonNegs: TeamNonNeg[]
  initialCompletedIds: string[]
  today: string
}

export default function NonNegClient({ nonNegs, initialCompletedIds }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set(initialCompletedIds))
  const [loading, setLoading] = useState<Set<string>>(new Set())

  async function toggle(id: string) {
    if (loading.has(id)) return
    setLoading(prev => new Set(prev).add(id))

    const isDone = completed.has(id)
    const method = isDone ? 'DELETE' : 'POST'

    try {
      await fetch(`/api/team/non-negotiables/${id}/complete`, { method })
      setCompleted(prev => {
        const next = new Set(prev)
        isDone ? next.delete(id) : next.add(id)
        return next
      })
    } finally {
      setLoading(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const pct = nonNegs.length > 0 ? Math.round((completed.size / nonNegs.length) * 100) : 0

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Non-negotiables
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Daily commitments set by your coach
        </p>
      </div>

      {/* Progress bar */}
      {nonNegs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
              {completed.size}/{nonNegs.length} completed
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#10B981' : 'var(--text-2)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct === 100 ? '#10B981' : 'var(--accent)',
              borderRadius: 3, transition: 'width 300ms ease',
            }} />
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        {nonNegs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No non-negotiables yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>Your coach hasn&apos;t set any daily commitments for you.</p>
          </div>
        ) : (
          nonNegs.map((nn, i) => {
            const done = completed.has(nn.id)
            const busy = loading.has(nn.id)
            return (
              <div
                key={nn.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  borderBottom: i < nonNegs.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: busy ? 'wait' : 'pointer',
                  transition: 'background 120ms',
                }}
                onClick={() => toggle(nn.id)}
              >
                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: done ? 'none' : '2px solid var(--border-strong)',
                  background: done ? '#10B981' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}>
                  {done && (
                    <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: 14, color: done ? 'var(--text-3)' : 'var(--text-1)',
                  textDecoration: done ? 'line-through' : 'none',
                  flex: 1, transition: 'all 150ms',
                }}>
                  {nn.title}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
