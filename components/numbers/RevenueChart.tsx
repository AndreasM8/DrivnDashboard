'use client'

import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler,
} from 'chart.js'
import type { MonthlySnapshot } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

type View = 'revenue' | 'followers' | 'leads'

interface Props {
  history: MonthlySnapshot[]
  baseCurrency: string
}

function shortMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'short' })
}

export default function RevenueChart({ history, baseCurrency }: Props) {
  const [view, setView] = useState<View>('revenue')

  if (history.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">No data yet — your chart will appear here once you have monthly data.</p>
  }

  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  const labels = sorted.map(s => shortMonth(s.month))

  const datasets = view === 'revenue' ? [
    {
      label: 'Cash collected',
      data: sorted.map(s => s.cash_collected),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#3b82f6',
      borderWidth: 2,
    },
    {
      label: 'Contracted',
      data: sorted.map(s => s.revenue_contracted),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.05)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#8b5cf6',
      borderWidth: 2,
    },
  ] : view === 'followers' ? [
    {
      label: 'New followers',
      data: sorted.map(s => s.new_followers),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#10b981',
      borderWidth: 2,
    },
    {
      label: 'Clients signed',
      data: sorted.map(s => s.clients_signed),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#f59e0b',
      borderWidth: 2,
    },
  ] : [
    {
      label: 'Meetings booked',
      data: sorted.map(s => s.meetings_booked),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#6366f1',
      borderWidth: 2,
    },
  ]

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        {([['revenue', 'Revenue'], ['followers', 'Followers & closes'], ['leads', 'Leads']] as [View, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === v ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1f2937',
              titleColor: '#f9fafb',
              bodyColor: '#d1d5db',
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
            y: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
          },
        }}
      />
    </div>
  )
}
