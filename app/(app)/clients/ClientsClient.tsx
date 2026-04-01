'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Client, PaymentInstallment } from '@/types'
import ClientDrawer from '@/components/clients/ClientDrawer'
import AddClientModal from '@/components/modals/AddClientModal'

interface Props {
  initialClients: Client[]
  installments: PaymentInstallment[]
  userId: string
  baseCurrency: string
}

type FilterKey = 'all' | 'invoice_due' | 'plan' | 'upsell'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function PaymentDots({ installments }: { installments: PaymentInstallment[] }) {
  if (installments.length === 0) return null
  const sorted = [...installments].sort((a, b) => a.month_number - b.month_number)
  return (
    <div className="flex gap-1 flex-wrap">
      {sorted.map(inst => {
        const color = inst.paid
          ? 'bg-green-400'
          : new Date(inst.due_date) < new Date()
            ? 'bg-red-400'
            : 'bg-gray-200'
        return (
          <span
            key={inst.id}
            title={`Month ${inst.month_number}: ${inst.paid ? 'Paid' : 'Pending'}`}
            className={`w-3 h-3 rounded-full ${color}`}
          />
        )
      })}
    </div>
  )
}

export default function ClientsClient({ initialClients, installments, userId, baseCurrency }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [drawerClient, setDrawerClient] = useState<Client | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const allInstallments = installments

  // Stats
  const activeCount = clients.length
  const totalLtv = clients.reduce((sum, c) => sum + c.total_amount, 0)
  const invoicesDueSoon = allInstallments.filter(i => {
    const days = daysUntil(i.due_date)
    return !i.paid && days >= 0 && days <= 7
  }).length
  const upsellReady = clients.filter(c => c.upsell_reminder_set).length

  const filtered = useMemo(() => {
    let list = clients
    if (filter === 'invoice_due') {
      const dueClientIds = new Set(allInstallments.filter(i => !i.paid && daysUntil(i.due_date) <= 7 && daysUntil(i.due_date) >= 0).map(i => i.client_id))
      list = list.filter(c => dueClientIds.has(c.id))
    }
    if (filter === 'plan') list = list.filter(c => c.payment_type === 'plan')
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

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Clients</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add client
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-50 dark:border-slate-700">
        {[
          { label: 'Active clients', value: String(activeCount) },
          { label: 'LTV (months)', value: formatCurrency(totalLtv, baseCurrency) },
          { label: 'Invoices due soon', value: String(invoicesDueSoon) },
          { label: 'Upsell ready', value: String(upsellReady) },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
        {([
          { key: 'all', label: 'All clients' },
          { key: 'invoice_due', label: 'Invoice due' },
          { key: 'plan', label: 'Payment plan' },
          { key: 'upsell', label: 'Upsell ready' },
        ] as { key: FilterKey; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-3xl mb-3">👥</p>
            {clients.length === 0 ? (
              <>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">No clients yet</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Clients appear automatically when you close a deal in the Pipeline, or you can add them manually.</p>
                <button
                  onClick={() => setAddOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Add client
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">No clients match this filter</p>
                <button onClick={() => setFilter('all')} className="text-sm text-blue-600 hover:underline">Clear filter</button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-slate-500 text-left border-b border-gray-100 dark:border-slate-700">
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Payment</th>
                  <th className="pb-3 font-medium text-right">Monthly</th>
                  <th className="pb-3 font-medium text-right">LTV</th>
                  <th className="pb-3 font-medium">Payments</th>
                  <th className="pb-3 font-medium">Next invoice</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => {
                  const insts = getClientInstallments(client.id)
                  const nextDate = nextInvoiceDate(client.id)
                  const hasOverdue = insts.some(i => !i.paid && new Date(i.due_date) < new Date())

                  return (
                    <tr
                      key={client.id}
                      onClick={() => setDrawerClient(client)}
                      className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(client.full_name || client.ig_username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{client.full_name || client.ig_username}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">@{client.ig_username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs font-medium text-gray-600 dark:text-slate-400 capitalize">
                          {client.payment_type === 'pif' ? 'Paid in full' : client.payment_type === 'split' ? 'Split pay' : `Plan (${client.plan_months}mo)`}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-medium text-gray-900 dark:text-slate-100">
                        {client.monthly_amount ? formatCurrency(client.monthly_amount, baseCurrency) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {formatCurrency(client.total_amount, baseCurrency)}
                      </td>
                      <td className="py-3 pr-4">
                        <PaymentDots installments={insts} />
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-500 dark:text-slate-400">
                        {nextDate ? (
                          <span className={daysUntil(nextDate) <= 3 ? 'text-amber-600 font-medium' : ''}>
                            {new Date(nextDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {client.upsell_reminder_set ? (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 font-medium rounded-lg">Upsell set</span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setDrawerClient(client) }}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 font-medium rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors"
                            >
                              Set upsell
                            </button>
                          )}
                          {hasOverdue && (
                            <button className="text-xs px-2 py-1 bg-red-100 text-red-700 font-medium rounded-lg">Chase</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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
          onClose={() => setAddOpen(false)}
          onAdded={onClientAdded}
        />
      )}
    </div>
  )
}
