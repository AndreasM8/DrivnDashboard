'use client'

import { useState } from 'react'

export interface GuideStep {
  title: string
  description: string
  visual: React.ReactNode
}

interface Props {
  steps: GuideStep[]
  onClose?: () => void
}

export default function IntegrationGuide({ steps, onClose }: Props) {
  const [current, setCurrent] = useState(0)

  const step = steps[current]
  const total = steps.length

  return (
    <div className="mt-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase">
          Step {current + 1} of {total}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Visual mockup area */}
      <div className="mx-4 h-44 bg-gray-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 flex items-center justify-center">
        {step.visual}
      </div>

      {/* Title + description */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">{step.title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{step.description}</p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ← Back
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current
                  ? 'bg-blue-600 dark:bg-blue-400 w-4'
                  : 'bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        {current < total - 1 ? (
          <button
            onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  )
}
