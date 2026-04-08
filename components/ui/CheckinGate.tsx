'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeeklyCheckin, CheckinPrefill } from '@/types'

const WeeklyCheckinModal = dynamic(
  () => import('@/components/modals/WeeklyCheckinModal'),
  { ssr: false }
)

const EMPTY_PREFILL: CheckinPrefill = {
  followersGained: 0,
  repliesReceived: 0,
  callsBooked: 0,
  clientsClosed: 0,
  cashCollected: 0,
  revenueContracted: 0,
}

export default function CheckinGate({
  weekStart,
  weekEnd,
  currency,
  existingCheckin,
}: {
  weekStart: string
  weekEnd: string
  currency: string
  existingCheckin: WeeklyCheckin | null
}) {
  const [done, setDone] = useState(false)

  if (done) return null

  return (
    <WeeklyCheckinModal
      checkin={existingCheckin}
      prefill={EMPTY_PREFILL}
      currency={currency}
      weekStart={weekStart}
      weekEnd={weekEnd}
      canSnooze={false}
      mandatory={true}
      onSubmitted={() => setDone(true)}
      onSnoozed={() => { /* blocked when mandatory */ }}
    />
  )
}
