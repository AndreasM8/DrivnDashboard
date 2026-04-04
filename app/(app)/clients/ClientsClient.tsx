'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Client, PaymentInstallment, Product } from '@/types'
import ClientDrawer from '@/components/clients/ClientDrawer'
import AddClientModal from '@/components/modals/AddClientModal'
import ProductsPanel from '@/components/clients/ProductsPanel'

interface Props {
  initialClients: Client[]
  installments: PaymentInstallment[]
  userId: string
  baseCurrency: string
  products: Product[]
}

type FilterKey = 'all' | 'invoice_due' | 'plan' | 'upsell'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

// ─── Payment dots ─────────────────────────────────────────────────────────────

function PaymentDots({ installments }: { installments: PaymentInstallment[] }) {
  if (installments.length === 0) return null
  const sorted = [...installments].sort((a, b) => a.month_number - b.month_number)
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {sorted.map(inst => {
        const bg = inst.paid
          ? 'var(--success)'
          : new Date(inst.due_date) < new Date()
            ? 'var(--danger)'
            : 'var(--surface-3)'
        return (
          <span
            key={inst.id}
            title={`Month ${inst.month_number}: ${inst.paid ? 'Paid' : 'Pending'}`}
            style={{ width: '8px', height: '8px', borderRadius: '50%', background: bg, flexShrink: 0 }}
          />
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientsClient({ initialClients, installments, userId, baseCurrency, products }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filter, setFilter]   = useState<FilterKey>('all')
  const [search, setSearch]   = useState('')
  const [drawerClient, setDrawerClient] = useState<Client | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const allInstallments = installments

  // Stats
  const activeCount      = clients.length
  const clientsWithMonths = clients.filter(c => c.plan_months && c.plan_months > 0)
  const avgLtvMonths     = clientsWithMonths.length > 0
    ? Math.round(clientsWithMonths.reduce((sum, c) => sum + (c.plan_months ?? 0), 0) / clientsWithMonths.length)
    : null
  const invoicesDueSoon  = allInstallments.filter(i => {
    const d = daysUntil(i.due_date)
    return !i.paid && d >= 0 && d <= 7
  }).length
  const upsellReady = clients.filter(c => c.upsell_reminder_set).length

  const filtered = useMemo(() => {
    let list = clients
    if (filter === 'invoice_due') {
      const dueIds = new Set(allInstallments.filter(i => !i.paid && daysUntil(i.due_date) <= 7 && daysUntil(i.due_date) >= 0).map(i => i.client_id))
      list = list.filter(c => dueIds.has(c.id))
    }
    if (filter === 'plan')   list = list.filter(c => c.payment_type === 'plan')
    if (filter === 'upsell') list = list.filter(c => c.upsell_reminder_set)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.full_name.toLowerCase().includes(q) || c.ig_username.toLowerCase().includes(q))
    }
    return list
  }, [clients, filter, search, allInstallments])

  function getClientInstallments(clientId: string) {
    return allInstallments.filter(i => i.client_id === clientId)
  }

  function onClientUpdated(updated: Client) {
    setClients(cs => cs.map(c => c.id === updated.id ? updated : c))
    setDrawerClient(updated)
  }

  function onClientAdded(client: Client) {
    setClients(cs => [client, ...cs])
    setAddOpen(false)
  }

  function nextInvoiceDate(clientId: string) {
    const upcoming = allInstallments
      .filter(i => i.client_id === clientId && !i.paid && new Date(i.due_date) >= new Date())
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    return upcoming[0]?.due_date ?? null
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',          label: 'All clients' },
    { key: 'invoice_due',  label: 'Invoice due' },
    { key: 'plan',         label: 'Payment plan' },
    { key: 'upsell',       label: 'Upsell ready' },
  ]

  const STAT_CARDS = [
    { label: 'Active clients',     value: String(activeCount),                   accent: 'var(--accent)' },
    { label: 'Avg. plan length',   value: avgLtvMonths !== null ? `${avgLtvMonths} mo` : '—', accent: 'var(--success)' },
    { label: 'Invoices due soon',  value: String(invoicesDueSoon),               accent: invoicesDueSoon > 0 ? 'var(--warning)' : 'var(--border-strong)' },
    { label: 'Upsell ready',       value: String(upsellReady),                   accent: upsellReady > 0 ? 'var(--purple)' : 'var(--border-strong)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          flexShrink: 0,
        }}
      >
        <h1 className="page-title">Clients</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary"
          style={{ fontSize: '12px', padding: '5px 12px' }}
        >
          + Add client
        </button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          padding: '14px 24px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
        className="md:grid-cols-4"
      >
        {STAT_CARDS.map(s => (
          <div
            key={s.label}
            style={{
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-card)',
              padding: '10px 12px',
              borderLeft: `3px solid ${s.accent}`,
            }}
          >
            <p className="label-caps" style={{ marginBottom: '4px' }}>{s.label}</p>
            <p className="hero-num" style={{ fontSize: '22px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter + search bar ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-badge)',
              fontSize: '11px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              background: filter === f.key ? 'rgba(37,99,235,0.1)' : 'transparent',
              color: filter === f.key ? 'var(--accent)' : 'var(--text-2)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={e => { if (filter !== f.key) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { if (filter !== f.key) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="input-base"
            style={{ paddingLeft: '26px', width: '160px', fontSize: '12px', padding: '5px 8px 5px 26px' }}
          />
        </div>
      </div>

      {/* ── Client cards + Products panel ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: client list — 50% on desktop */}
        <div style={{ flex: '0 0 50%', overflowY: 'auto', padding: '16px 24px 88px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', maxWidth: '360px', margin: '0 auto' }}>
            {clients.length === 0 ? (
              <>
                <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '6px' }}>No clients yet</p>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                  Clients appear automatically when you close a deal in the Pipeline, or you can add them manually.
                </p>
                <button onClick={() => setAddOpen(true)} className="btn-primary">Add client</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '8px' }}>No clients match this filter</p>
                <button onClick={() => setFilter('all')} className="btn-ghost">Clear filter</button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '800px' }}>
            {filtered.map(client => {
              const insts     = getClientInstallments(client.id)
              const nextDate  = nextInvoiceDate(client.id)
              const hasOverdue = insts.some(i => !i.paid && new Date(i.due_date) < new Date())
              const isUpsell  = client.upsell_reminder_set
              const borderColor = hasOverdue ? 'var(--danger)' : isUpsell ? 'var(--purple)' : 'var(--border)'

              return (
                <div
                  key={client.id}
                  onClick={() => setDrawerClient(client)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--surface-1)',
                    border: `1px solid ${borderColor}`,
                    borderLeft: `3px solid ${borderColor}`,
                    boxShadow: 'var(--shadow-card)',
                    cursor: 'pointer',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.boxShadow = 'var(--shadow-raised)'
                    if (!hasOverdue && !isUpsell) el.style.borderColor = 'var(--border-strong)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.boxShadow = 'var(--shadow-card)'
                    el.style.borderColor = borderColor
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'rgba(37,99,235,0.12)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: '700',
                      flexShrink: 0,
                    }}
                  >
                    {(client.full_name || client.ig_username).charAt(0).toUpperCase()}
                  </div>

                  {/* Name + handle */}
                  <div style={{ minWidth: 0, flex: '0 0 160px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                      {client.full_name || client.ig_username}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{client.ig_username}
                    </p>
                  </div>

                  {/* Payment type */}
                  <div style={{ flex: '0 0 100px' }}>
                    <span
                      className="badge"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: '10px' }}
                    >
                      {client.payment_type === 'pif' ? 'Paid in full' : client.payment_type === 'split' ? 'Split pay' : `Plan (${client.plan_months}mo)`}
                    </span>
                  </div>

                  {/* Monthly */}
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      {client.monthly_amount ? formatCurrency(client.monthly_amount, baseCurrency) : '—'}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>/ month</p>
                  </div>

                  {/* LTV */}
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>
                      {formatCurrency(client.total_amount, baseCurrency)}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>total</p>
                  </div>

                  {/* Payment dots */}
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <PaymentDots installments={insts} />
                  </div>

                  {/* Next invoice */}
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
                    {nextDate ? (
                      <p style={{ fontSize: '12px', color: daysUntil(nextDate) <= 3 ? 'var(--warning)' : 'var(--text-2)', fontWeight: daysUntil(nextDate) <= 3 ? '600' : '400' }}>
                        {new Date(nextDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </p>
                    ) : (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>—</p>
                    )}
                    <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>next invoice</p>
                  </div>

                  {/* Actions */}
                  <div
                    style={{ flex: '0 0 auto', display: 'flex', gap: '6px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {isUpsell ? (
                      <span
                        className="badge"
                        style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--purple)', fontSize: '10px' }}
                      >
                        Upsell set
                      </span>
                    ) : (
                      <button
                        onClick={() => setDrawerClient(client)}
                        className="btn-ghost"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.1)'
                          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--purple)'
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.3)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
                        }}
                      >
                        Set upsell
                      </button>
                    )}
                    {hasOverdue && (
                      <button
                        onClick={() => setDrawerClient(client)}
                        className="badge"
                        style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', fontSize: '10px', border: 'none', cursor: 'pointer' }}
                      >
                        Overdue
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>

        {/* Right: products panel */}
        <div
          className="hidden md:block"
          style={{
            flex: '0 0 50%',
            borderLeft: '1px solid var(--border)',
            overflowY: 'auto',
            paddingBottom: 88,
          }}
        >
          <ProductsPanel initialProducts={products} baseCurrency={baseCurrency} />
        </div>

      </div>

      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          installments={getClientInstallments(drawerClient.id)}
          baseCurrency={baseCurrency}
          onClose={() => setDrawerClient(null)}
          onUpdate={onClientUpdated}
        />
      )}

      {addOpen && (
        <AddClientModal
          userId={userId}
          baseCurrency={baseCurrency}
          products={products}
          onClose={() => setAddOpen(false)}
          onAdded={onClientAdded}
        />
      )}
    </div>
  )
}
