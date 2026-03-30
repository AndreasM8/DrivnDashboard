'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { TeamMember, TeamRole, TeamStatus } from '@/types'

interface Props {
  userId: string
  initialMembers: TeamMember[]
}

const ROLE_LABELS: Record<TeamRole, string> = {
  setter: 'Setter',
  closer: 'Closer',
  both: 'Setter + Closer',
  admin: 'Admin',
}

const STATUS_STYLES: Record<TeamStatus, string> = {
  invited:     'bg-amber-100 text-amber-700',
  active:      'bg-green-100 text-green-700',
  deactivated: 'bg-gray-100 text-gray-500',
}

function InviteModal({ userId, onClose, onInvited }: { userId: string; onClose: () => void; onInvited: (m: TeamMember) => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<TeamRole>('setter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: err } = await supabase.from('team_members').insert({
      workspace_id: userId,
      email,
      name,
      role,
      status: 'invited',
    }).select().single()

    if (err) {
      setError(err.message)
    } else if (data) {
      onInvited(data as TeamMember)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Invite someone</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Alex"
              required
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="team@example.com"
              required
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as TeamRole)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="setter">Setter</option>
              <option value="closer">Closer</option>
              <option value="both">Setter + Closer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TeamClient({ userId, initialMembers }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const supabase = createClient()

  async function deactivate(id: string) {
    await supabase.from('team_members').update({ status: 'deactivated' }).eq('id', id)
    setMembers(ms => ms.map(m => m.id === id ? { ...m, status: 'deactivated' } : m))
  }

  async function resendInvite(id: string) {
    await supabase.from('team_members').update({ invite_sent_at: new Date().toISOString() }).eq('id', id)
  }

  const PERMISSION_ROWS = [
    { action: 'Add leads to pipeline',     setter: true,  closer: false, both: true,  admin: true  },
    { action: 'Move leads to call booked', setter: true,  closer: false, both: true,  admin: true  },
    { action: 'Log call outcomes',         setter: false, closer: true,  both: true,  admin: true  },
    { action: 'View pipeline',             setter: true,  closer: true,  both: true,  admin: true  },
    { action: 'View clients',              setter: false, closer: true,  both: true,  admin: true  },
    { action: 'View numbers',              setter: false, closer: false, both: false, admin: true  },
    { action: 'Submit EOD report',         setter: true,  closer: true,  both: true,  admin: true  },
    { action: 'Invite team members',       setter: false, closer: false, both: false, admin: false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Team</h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          Invite someone
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-8 bg-gray-50 dark:bg-slate-900">
        {/* Member list */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
          {members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">No team members yet</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Invite setters or closers to collaborate.</p>
              <button onClick={() => setInviteOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">Invite someone</button>
            </div>
          ) : (
            <div>
              {members.map((member, i) => (
                <div key={member.id} className={`flex items-center gap-4 p-4 ${i < members.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold flex-shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{member.name}</p>
                      <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[member.role]}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[member.status]}`}>
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{member.email}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {member.status === 'invited' && (
                      <button
                        onClick={() => resendInvite(member.id)}
                        className="text-xs px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Resend
                      </button>
                    )}
                    {member.status === 'active' && (
                      <button
                        onClick={() => deactivate(member.id)}
                        className="text-xs px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 rounded-lg hover:border-red-200 hover:text-red-600 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Permissions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-slate-500 border-b border-gray-50 dark:border-slate-700">
                  <th className="pb-2 font-medium text-left">Action</th>
                  <th className="pb-2 font-medium text-center">Setter</th>
                  <th className="pb-2 font-medium text-center">Closer</th>
                  <th className="pb-2 font-medium text-center">Both</th>
                  <th className="pb-2 font-medium text-center">Admin</th>
                  <th className="pb-2 font-medium text-center">Owner</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map(row => (
                  <tr key={row.action} className="border-b border-gray-50 dark:border-slate-700 last:border-0">
                    <td className="py-2.5 text-gray-700 dark:text-slate-300">{row.action}</td>
                    {[row.setter, row.closer, row.both, row.admin, true].map((v, i) => (
                      <td key={i} className="py-2.5 text-center">
                        {v
                          ? <span className="text-green-500 font-bold">✓</span>
                          : <span className="text-gray-200 dark:text-slate-700">—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          userId={userId}
          onClose={() => setInviteOpen(false)}
          onInvited={m => { setMembers(ms => [...ms, m]); setInviteOpen(false) }}
        />
      )}
    </div>
  )
}
