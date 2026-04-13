'use client'
import { useEffect, useState, useCallback } from 'react'
import { useWalkthrough } from './WalkthroughContext'

interface Rect { top: number; left: number; width: number; height: number }

function getRect(target: string): Rect | null {
  const el = document.querySelector(`[data-walkthrough="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function TooltipCard({
  rect,
  title,
  description,
  step,
  total,
  position,
  onNext,
  onSkip,
}: {
  rect: Rect
  title: string
  description: string
  step: number
  total: number
  position?: 'top' | 'bottom' | 'left' | 'right'
  onNext: () => void
  onSkip: () => void
}) {
  const PAD = 16
  const CARD_W = 280

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const cx = rect.left + rect.width / 2

  // Compute tooltip position
  const style: React.CSSProperties = { position: 'fixed', zIndex: 10001, width: CARD_W }

  const preferredPos = position ?? (cx < vw / 2 ? 'right' : 'left')

  if (preferredPos === 'right' && rect.left + rect.width + PAD + CARD_W < vw) {
    style.left = rect.left + rect.width + PAD
    style.top = Math.max(PAD, Math.min(rect.top, vh - 220))
  } else if (preferredPos === 'left' && rect.left - PAD - CARD_W > 0) {
    style.left = rect.left - PAD - CARD_W
    style.top = Math.max(PAD, Math.min(rect.top, vh - 220))
  } else if (preferredPos === 'bottom' || rect.top + rect.height / 2 < vh / 2) {
    style.top = rect.top + rect.height + PAD
    style.left = Math.max(PAD, Math.min(cx - CARD_W / 2, vw - CARD_W - PAD))
  } else {
    style.bottom = vh - rect.top + PAD
    style.left = Math.max(PAD, Math.min(cx - CARD_W / 2, vw - CARD_W - PAD))
  }

  const isLast = step === total - 1

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        ...style,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--neon-indigo)',
        borderRadius: 14,
        padding: '18px 20px',
        boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 20px 48px rgba(0,0,0,0.7), var(--glow-indigo)',
        color: 'var(--text-1)',
      }}
    >
      {/* Step counter */}
      <p style={{ fontSize: 11, color: 'var(--neon-indigo)', fontWeight: 600, margin: '0 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {step + 1} / {total}
      </p>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-1)' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>{description}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onSkip}
          style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Skip tour
        </button>
        <button
          onClick={onNext}
          style={{
            fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, var(--neon-indigo), var(--neon-cyan))',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer',
            boxShadow: 'var(--glow-indigo)',
          }}
        >
          {isLast ? 'Done \u2713' : 'Next \u2192'}
        </button>
      </div>
    </div>
  )
}

export default function WalkthroughOverlay() {
  const { active, step, total, currentStep, next, skip } = useWalkthrough()
  const [rect, setRect] = useState<Rect | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const updateRect = useCallback(() => {
    if (!currentStep) { setRect(null); return }
    const found = getRect(currentStep.target)
    // If element not found, skip this step automatically
    if (!found) { next(); return }
    setRect(found)
    setDims({ w: window.innerWidth, h: window.innerHeight })
  }, [currentStep, next])

  useEffect(() => {
    if (!active || !currentStep) { setRect(null); return }
    // Small delay to let any navigation settle
    const t = setTimeout(updateRect, 80)
    window.addEventListener('resize', updateRect)
    return () => { clearTimeout(t); window.removeEventListener('resize', updateRect) }
  }, [active, currentStep, updateRect])

  if (!active || !currentStep) return null

  const PAD = 8  // padding around spotlight target
  const R = 10   // border-radius of spotlight

  const w = dims.w || (typeof window !== 'undefined' ? window.innerWidth : 1024)
  const h = dims.h || (typeof window !== 'undefined' ? window.innerHeight : 768)

  // SVG spotlight path: full rect minus rounded rect cutout around target
  const spotlight = rect
    ? [
        `M0,0 H${w} V${h} H0 Z`,
        `M${rect.left - PAD},${rect.top - PAD}`,
        `Q${rect.left - PAD},${rect.top - PAD - R} ${rect.left - PAD + R},${rect.top - PAD - R}`,
        `H${rect.left + rect.width + PAD - R}`,
        `Q${rect.left + rect.width + PAD},${rect.top - PAD - R} ${rect.left + rect.width + PAD},${rect.top - PAD}`,
        `V${rect.top + rect.height + PAD}`,
        `Q${rect.left + rect.width + PAD},${rect.top + rect.height + PAD + R} ${rect.left + rect.width + PAD - R},${rect.top + rect.height + PAD + R}`,
        `H${rect.left - PAD + R}`,
        `Q${rect.left - PAD},${rect.top + rect.height + PAD + R} ${rect.left - PAD},${rect.top + rect.height + PAD}`,
        'Z',
      ].join(' ')
    : `M0,0 H${w} V${h} H0 Z`

  return (
    <>
      {/* Dimmed overlay with spotlight cutout */}
      <svg
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none' }}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <path d={spotlight} fill="rgba(0,0,0,0.75)" fillRule="evenodd" />
        {rect && (
          <rect
            x={rect.left - PAD}
            y={rect.top - PAD}
            width={rect.width + PAD * 2}
            height={rect.height + PAD * 2}
            rx={R}
            fill="none"
            stroke="rgba(99,102,241,0.7)"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* Click anywhere on overlay to advance */}
      <div
        onClick={next}
        style={{ position: 'fixed', inset: 0, zIndex: 10000, cursor: 'default' }}
      />

      {/* Tooltip */}
      {rect && (
        <TooltipCard
          rect={rect}
          title={currentStep.title}
          description={currentStep.description}
          step={step}
          total={total}
          position={currentStep.position}
          onNext={next}
          onSkip={skip}
        />
      )}
    </>
  )
}
