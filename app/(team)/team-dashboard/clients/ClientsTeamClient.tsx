'use client'

import type { Client, PaymentInstallment } from '@/types'

interface Props {
  clients: Client[]
  installments: PaymentInstallment[]
  hasFinances: boolean
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`
}

function getNextInstallment(installments: PaymentInstallment[], clientId: string): PaymentInstallment | null {
  const unpaid = installments
    .filter(i => i.client_id === clientId && !i.paid)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  return unpaid[0] ?? null
}

function PaymentStatusBadge({ client, installments }: { client: Client; installments: PaymentInstallment[] }) {
  const balance = client.total_amount - client.total_paid
  const next = getNextInstallment(installments, client.id)
  const isOverdue = next ? new Date(next.due_date) < new Date() : false

  let text: string
  let bg: string
  let color: string

  if (client.total_paid >= client.total_amount) {
    text = 'Paid in full'
    bg = 'rgba(16,185,129,0.1)'
    color = '#10B981'
  } else if (isOverdue) {
    text = 'Overdue'
    bg = 'rgba(220,38,38,0.1)'
    color = '#DC2626'
  } else if (next) {
    text = `Due ${formatDate(next.due_date)}`
    bg = 'rgba(245,158,11,0.1)'
    color = '#F59E0B'
  } else if (balance > 0) {
    text = 'Balance remaining'
    bg = 'rgba(100,116,139,0.1)'
    color = '#64748B'
  } else {
    text = 'Up to date'
    bg = 'rgba(16,185,129,0.1)'
    color = '#10B981'
  }

  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
      background: bg, color,
    }}>
      {text}
    </span>
  )
}

export default function ClientsTeamClient({ clients, installments, hasFinances }: Props) {
  if (clients.length === 0) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Clients</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Active clients</p>
        </div>
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
        }}>
          <p style={{ fontSize: 15, color: 'var(--text-2)' }}>No active clients found.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Clients</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          {clients.length} active client{clients.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {clients.map(client => {
          const balance = client.total_amount - client.total_paid
          const next = getNextInstallment(installments, client.id)

          return (
            <div
              key={client.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '16px 18px',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: hasFinances ? 14 : 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                      {client.full_name || client.ig_username}
                    </span>
                    {client.program_type && (
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 5,
                        background: 'var(--surface-2)', color: 'var(--text-2)',
                        border: '1px solid var(--border)',
                      }}>
                        {client.program_type}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Started {formatDate(client.started_at)}
                    </span>
                    {client.contract_end_date && (
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        Ends {formatDate(client.contract_end_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment status badge */}
                <div style={{ flexShrink: 0 }}>
                  <PaymentStatusBadge client={client} installments={installments} />
                </div>
              </div>

              {/* Finance details */}
              {hasFinances && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 10,
                  padding: '12px 0 0',
                  borderTop: '1px solid var(--border)',
                }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                      Total
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                      {formatAmount(client.total_amount, client.currency)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                      Paid
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                      {formatAmount(client.total_paid, client.currency)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                      Balance
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: balance > 0 ? '#F59E0B' : '#10B981' }}>
                      {balance > 0 ? formatAmount(balance, client.currency) : 'Settled'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                      Next payment
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: next ? (new Date(next.due_date) < new Date() ? '#DC2626' : 'var(--text-1)') : 'var(--text-3)' }}>
                      {next ? formatDate(next.due_date) : '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
