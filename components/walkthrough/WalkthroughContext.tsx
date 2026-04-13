'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'drivn_walkthrough_done'

interface Step {
  target: string      // data-walkthrough value
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'  // preferred tooltip side
}

const STEPS: Step[] = [
  {
    target: 'dashboard-stats',
    title: 'Your dashboard',
    description: 'See your key numbers at a glance — cash collected, active clients, calls this month, and new sign-ups. These update in real time as you log activity.',
    position: 'bottom',
  },
  {
    target: 'dashboard-tasks',
    title: 'Do these today',
    description: 'Your most important actions for today — follow-ups that are overdue and leads who need attention. Checking these off keeps your pipeline moving.',
    position: 'top',
  },
  {
    target: 'nav-pipeline',
    title: 'Pipeline',
    description: 'Track every lead from first DM to closed deal. Move leads between stages by dragging or tapping, and log follow-ups so nothing falls through the cracks.',
    position: 'right',
  },
  {
    target: 'nav-clients',
    title: 'Clients',
    description: 'All your active clients in one place. See check-in status, contract end dates, and who needs attention — so you deliver results and retain clients longer.',
    position: 'right',
  },
  {
    target: 'nav-tasks',
    title: 'Tasks & non-negotiables',
    description: 'Your daily non-negotiables (the minimum actions that drive growth) live here alongside auto-generated follow-up tasks from your pipeline.',
    position: 'right',
  },
  {
    target: 'nav-numbers',
    title: 'Numbers',
    description: 'Log your monthly performance — revenue, calls, close rate. This is your accountability snapshot and the data behind your pipeline funnel.',
    position: 'right',
  },
  {
    target: 'nav-checkins',
    title: 'Weekly check-ins',
    description: 'A structured weekly review of your business — wins, challenges, focus for next week. Builds the habit of working ON your business, not just in it.',
    position: 'right',
  },
  {
    target: 'nav-ask',
    title: 'AI Coach',
    description: 'Your personal AI coaching assistant. Write reel scripts, generate DM openers, plan content, handle objections — trained on what works for online fitness coaches.',
    position: 'right',
  },
]

interface WalkthroughCtx {
  active: boolean
  step: number
  total: number
  currentStep: Step | null
  start: () => void
  next: () => void
  skip: () => void
}

const Ctx = createContext<WalkthroughCtx>({
  active: false, step: 0, total: STEPS.length, currentStep: null,
  start: () => {}, next: () => {}, skip: () => {},
})

export function useWalkthrough() { return useContext(Ctx) }

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  // Auto-start for new users (no localStorage entry)
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Small delay to let the page render first
      const t = setTimeout(() => setActive(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const start = useCallback(() => { setStep(0); setActive(true) }, [])

  const next = useCallback(() => {
    setStep(s => {
      if (s >= STEPS.length - 1) {
        setActive(false)
        localStorage.setItem(STORAGE_KEY, '1')
        return 0
      }
      return s + 1
    })
  }, [])

  const skip = useCallback(() => {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, '1')
    setStep(0)
  }, [])

  return (
    <Ctx.Provider value={{ active, step, total: STEPS.length, currentStep: active ? STEPS[step] : null, start, next, skip }}>
      {children}
    </Ctx.Provider>
  )
}
