'use client'

import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip,
} from 'chart.js'
import type { MonthlySnapshot } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

type Tab = 'revenue' | 'sales' | 'growth'

interface Props {
  history: MonthlySnapshot[]
  baseCurrency: string
}

function shortMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'short' })
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'sales',   label: 'Sales'   },
  { id: 'growth',  label: 'Growth'  },
]

export default function RevenueChart({ history }: Props) {
  const [tab, setTab] = useState<Tab>('revenue')

  if (history.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '40px 0' }}>
        No data yet — your chart will appear here once you have monthly data.
      </p>
    )
  }

  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  const labels  = sorted.map(s => shortMonth(s.month))

  const BASE_DATASET = {
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 5,
    borderWidth: 2,
  }

  const datasets = tab === 'revenue' ? [
    {
      ...BASE_DATASET,
      label: 'Cash collected',
      data: sorted.map(s => s.cash_collected),
      borderColor: '#3B82F6',
      pointHoverBackgroundColor: '#3B82F6',
    },
    {
      ...BASE_DATASET,
      label: 'Revenue contracted',
      data: sorted.map(s => s.revenue_contracted),
      borderColor: '#8B5CF6',
      pointHoverBackgroundColor: '#8B5CF6',
    },
  ] : tab === 'sales' ? [
    {
      ...BASE_DATASET,
      label: 'Show-up rate',
      data: sorted.map(s => s.show_up_rate),
      borderColor: '#10B981',
      pointHoverBackgroundColor: '#10B981',
    },
    {
      ...BASE_DATASET,
      label: 'Close rate',
      data: sorted.map(s => s.close_rate),
      borderColor: '#6366F1',
      pointHoverBackgroundColor: '#6366F1',
    },
  ] : [
    {
      ...BASE_DATASET,
      label: 'New followers',
      data: sorted.map(s => s.new_followers),
      borderColor: '#34D399',
      pointHoverBackgroundColor: '#34D399',
    },
    {
      ...BASE_DATASET,
      label: 'Clients signed',
      data: sorted.map(s => s.clients_signed),
      borderColor: '#F59E0B',
      pointHoverBackgroundColor: '#F59E0B',
    },
  ]

  return (
    <div>
      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-btn)',
              fontSize: '12px',
              fontWeight: tab === t.id ? '500' : '400',
              color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)',
              background: tab === t.id ? 'var(--surface-2)' : 'transparent',
              border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ height: '200px' }}>
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
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
              x: {
                grid: { display: false },
                ticks: { color: '#9CA3AF', font: { size: 11 } },
              },
              y: {
                grid: { color: 'rgba(0,0,0,0.06)' },
                ticks: { color: '#9CA3AF', font: { size: 11 } },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
