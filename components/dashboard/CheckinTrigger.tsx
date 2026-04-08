'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeeklyCheckin, CheckinPrefill } from '@/types'

const WeeklyCheckinModal = dynamic(() => import('@/components/modals/WeeklyCheckinModal'), { ssr: false })

interface Props {
  initialDue: boolean
  isOverdue: boolean
  checkin: WeeklyCheckin | null
  prefill: CheckinPrefill
  currency: string
  weekStart: string
  weekEnd: string
  canSnooze: boolean
}

export default function CheckinTrigger({
  initialDue,
  isOverdue,
  checkin,
  prefill,
  currency,
  weekStart,
  weekEnd,
  canSnooze,
}: Props) {
  const [open, setOpen] = useState(initialDue)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      {/* Overdue banner */}
      {isOverdue && !open && (
        <div style={{
          background: 'rgba(220,38,38,0.07)',
          border: '1px solid rgba(220,38,38,0.25)',
          borderRadius: 'var(--radius-card)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
              Your weekly check-in is overdue
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              It only takes 2 minutes — fill it in to keep your streak going.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 'var(--radius-btn)',
              background: '#DC2626',
              color: '#fff',
              border: 'none',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fill in now
          </button>
        </div>
      )}

      {/* Due banner (not overdue) */}
      {initialDue && !isOverdue && !open && (
        <div style={{
          background: 'rgba(37,99,235,0.06)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: 'var(--radius-card)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              Weekly check-in ready
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              Reflect on your week and lock in your numbers.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 'var(--radius-btn)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start →
          </button>
        </div>
      )}

      {/* Modal */}
      {open && (
        <WeeklyCheckinModal
          checkin={checkin}
          prefill={prefill}
          currency={currency}
          weekStart={weekStart}
          weekEnd={weekEnd}
          canSnooze={canSnooze}
          onSubmitted={() => {
            setOpen(false)
            setDismissed(true)
          }}
          onSnoozed={() => {
            setOpen(false)
            setDismissed(true)
          }}
        />
      )}
    </>
  )
}
