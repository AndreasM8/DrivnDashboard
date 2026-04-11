'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ANDREAS_AGENTS, SEBASTIAN_AGENTS, AgentDef, AgentField } from '@/lib/assistants/agents'

type AssistantSlug = 'andreas' | 'sebastian'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ASSISTANT_META: Record<AssistantSlug, {
  name: string
  emoji: string
  tagline: string
  accentColor: string
  accentBg: string
}> = {
  andreas: {
    name: 'Andreas',
    emoji: '🎯',
    tagline: 'Content, brand & Instagram growth',
    accentColor: '#f97316',
    accentBg: '#f97316',
  },
  sebastian: {
    name: 'Sebastian',
    emoji: '💼',
    tagline: 'Sales, DMs & closing clients',
    accentColor: 'var(--accent)',
    accentBg: 'var(--accent)',
  },
}

const ALL_AGENTS: Record<AssistantSlug, AgentDef[]> = {
  andreas: ANDREAS_AGENTS,
  sebastian: SEBASTIAN_AGENTS,
}

// ─── Agent tool modal ─────────────────────────────────────────────────────────

function AgentModal({
  agent,
  assistantName,
  accentBg,
  onClose,
  onSubmit,
}: {
  agent: AgentDef
  assistantName: string
  accentBg: string
  onClose: () => void
  onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(agent.fields.map(f => [f.id, f.options?.[0] ?? ''])),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let prompt = agent.prompt
    for (const [key, val] of Object.entries(values)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
    }
    onSubmit(values)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: '0 16px 16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', width: '100%', maxWidth: 512, borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: accentBg, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{agent.icon}</span>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }}>{agent.label}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>{agent.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          {agent.fields.map(field => (
            <div key={field.id}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="input-base"
                  style={{ resize: 'none' }}
                  required
                />
              ) : field.type === 'select' ? (
                <select
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="input-base"
                  required
                >
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="input-base"
                  required
                />
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1, padding: '10px 0' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-btn)', background: accentBg, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Generate with {assistantName}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, accentBg }: { message: ChatMessage; accentBg: string }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '80%',
          background: 'linear-gradient(135deg, var(--neon-indigo), rgba(99,102,241,0.7))',
          color: 'white',
          borderRadius: '12px 12px 2px 12px',
          padding: '10px 14px',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant message — render with basic markdown-like formatting
  const formatted = message.content
    .split('\n')
    .map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <p key={i} style={line === '' ? { height: 12, margin: 0 } : { margin: 0, lineHeight: 1.6 }}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
          )}
        </p>
      )
    })

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ maxWidth: '85%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 13, color: 'var(--text-1)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{formatted}</div>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 2px', padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{ width: 6, height: 6, background: 'var(--text-3)', borderRadius: '50%', display: 'inline-block', animationDelay: `${i * 0.15}s` }}
              className="animate-bounce"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING: Record<AssistantSlug, {
  headline: string
  subtext: string
  fields: { id: string; label: string; placeholder: string; memoryKey: string }[]
}> = {
  andreas: {
    headline: 'Hei! La oss bli kjent 👋',
    subtext: 'Svar på noen raske spørsmål så kan jeg hjelpe deg med personalisert content fra første melding.',
    fields: [
      { id: 'niche',              label: 'Hva er nisjen din?',                          placeholder: 'F.eks. vekttap for kvinner 30+, styrketrening for menn, løping…',    memoryKey: 'niche' },
      { id: 'target_audience',   label: 'Hvem er din ideelle klient?',                 placeholder: 'Alder, mål, hva de sliter med…',                                      memoryKey: 'target_audience' },
      { id: 'brand_voice',       label: 'Hva er tonen din på sosiale medier?',         placeholder: 'F.eks. direkte og ærlig, motiverende, humoristisk, personlig…',       memoryKey: 'brand_voice' },
      { id: 'what_works',        label: 'Hva er noen av dine beste klientresultater?', placeholder: 'F.eks. "klient X gikk ned 12 kg på 3 mnd"…',                          memoryKey: 'what_works' },
      { id: 'content_challenges',label: 'Hva sliter du mest med på content-siden?',   placeholder: 'F.eks. konsistens, hooks, ideer, engagement…',                         memoryKey: 'content_challenges' },
    ],
  },
  sebastian: {
    headline: 'Hei! La oss bli kjent 👋',
    subtext: 'Svar på noen raske spørsmål så kan jeg hjelpe deg med skreddersydde salgsskript og DM-strategier.',
    fields: [
      { id: 'niche',           label: 'Hva er nisjen din?',                           placeholder: 'F.eks. vekttap, styrketrening, mental helse…',                         memoryKey: 'niche' },
      { id: 'revenue_range',   label: 'Hva er tilbudet ditt og prisen?',              placeholder: 'F.eks. 1:1 coaching 3 mnd til 15 000 kr…',                            memoryKey: 'revenue_range' },
      { id: 'target_audience', label: 'Beskriv din ideelle klient',                   placeholder: 'Alder, livssituasjon, hva de ønsker å oppnå…',                        memoryKey: 'target_audience' },
      { id: 'sales_challenges',label: 'Hva er de vanligste innvendingene du møter?',  placeholder: 'F.eks. "for dyrt", "må tenke meg om", "har ikke tid"…',               memoryKey: 'sales_challenges' },
      { id: 'what_works',      label: 'Hva gjør tilbudet ditt unikt?',               placeholder: 'Din USP, beste klientresultat, hva du gjør annerledes…',              memoryKey: 'what_works' },
    ],
  },
}

function OnboardingScreen({
  assistant,
  meta,
  onComplete,
}: {
  assistant: AssistantSlug
  meta: typeof ASSISTANT_META[AssistantSlug]
  onComplete: () => void
}) {
  const config = ONBOARDING[assistant]
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(config.fields.map(f => [f.id, ''])),
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const memoryPayload: Record<string, string> = { assistant }
    for (const field of config.fields) {
      if (values[field.id]?.trim()) {
        memoryPayload[field.memoryKey] = values[field.id].trim()
      }
    }

    await fetch('/api/assistants/memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memoryPayload),
    })

    setSaving(false)
    onComplete()
  }

  const filledCount = config.fields.filter(f => values[f.id]?.trim()).length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ maxWidth: 512, margin: '0 auto' }}>
        {/* Avatar + headline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: meta.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
            {meta.emoji}
          </div>
          <div>
            <h2 style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 16, lineHeight: 1.2, margin: 0 }}>{config.headline}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>{config.subtext}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {config.fields.map(field => (
            <div key={field.id}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
                {field.label}
              </label>
              <textarea
                value={values[field.id]}
                onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                placeholder={field.placeholder}
                rows={2}
                className="input-base"
                style={{ resize: 'none', lineHeight: 1.6 }}
              />
            </div>
          ))}

          <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              disabled={saving || filledCount === 0}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: filledCount > 0 && !saving ? 'pointer' : 'not-allowed', transition: 'opacity 150ms',
                background: filledCount > 0 && !saving ? meta.accentBg : 'var(--surface-3)',
                color: filledCount > 0 && !saving ? '#fff' : 'var(--text-3)',
              }}
            >
              {saving ? 'Lagrer…' : `Start samtale med ${meta.name} →`}
            </button>
            <button
              type="button"
              onClick={onComplete}
              style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 120ms' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              Hopp over
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssistantPageClient({
  assistant,
  initialMessages,
  hasMemory,
}: {
  assistant: AssistantSlug
  initialMessages: ChatMessage[]
  hasMemory: boolean
}) {
  const meta = ASSISTANT_META[assistant]
  const agents = ALL_AGENTS[assistant]

  const [memoryReady, setMemoryReady] = useState(hasMemory)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [activeAgent, setActiveAgent] = useState<AgentDef | null>(null)
  const [showAgents, setShowAgents] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const sendMessage = useCallback(async (userText: string, agentPrompt?: string) => {
    if (!userText.trim() && !agentPrompt) return
    if (streaming) return

    const userMessage: ChatMessage = { role: 'user', content: userText || '[Agent tool used]' }
    const newMessages = agentPrompt ? messages : [...messages, userMessage]

    if (!agentPrompt) {
      setMessages(prev => [...prev, userMessage])
    }

    setStreaming(true)
    setInput('')

    // Add placeholder for streaming assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/assistants/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant,
          messages: agentPrompt ? messages : newMessages,
          agentPrompt,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: accumulated }
                return updated
              })
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }, [assistant, messages, streaming])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleAgentSubmit(values: Record<string, string>) {
    if (!activeAgent) return
    // Build the agent prompt
    let prompt = activeAgent.prompt
    for (const [key, val] of Object.entries(values)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
    }
    // Replace {USER_MEMORY} placeholder — server will fill it in
    const userDisplayText = `[${activeAgent.label}] ${Object.values(values).join(' · ')}`
    setMessages(prev => [...prev, { role: 'user', content: userDisplayText }])
    setShowAgents(false)
    setActiveAgent(null)

    // Send with agentPrompt
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const abortController = new AbortController()
    abortRef.current = abortController

    let accumulated = ''

    fetch('/api/assistants/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant, messages, agentPrompt: prompt }),
      signal: abortController.signal,
    })
      .then(async res => {
        if (!res.ok || !res.body) throw new Error('Stream failed')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data) as { text?: string }
              if (parsed.text) {
                accumulated += parsed.text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: accumulated }
                  return updated
                })
              }
            } catch { /* skip */ }
          }
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Try again.' }
            return updated
          })
        }
      })
      .finally(() => setStreaming(false))
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <Link
          href="/ask"
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: 'var(--text-2)', transition: 'background 120ms, color 120ms', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: meta.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 14, lineHeight: 1, margin: 0 }}>{meta.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.tagline}</p>
        </div>
        {/* Agent tools button */}
        <button
          onClick={() => setShowAgents(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 120ms',
            background: showAgents ? meta.accentBg : 'var(--surface-2)',
            color: showAgents ? '#fff' : 'var(--text-2)',
          }}
          onMouseEnter={e => { if (!showAgents) (e.currentTarget.style.background = 'var(--surface-3)') }}
          onMouseLeave={e => { if (!showAgents) (e.currentTarget.style.background = 'var(--surface-2)') }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
          </svg>
          Tools
        </button>
      </div>

      {/* Agent tools panel */}
      {showAgents && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => { setActiveAgent(agent); setShowAgents(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-1)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <span>{agent.icon}</span>
                {agent.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding — shown on first visit when no memory exists */}
      {!memoryReady && (
        <OnboardingScreen
          assistant={assistant}
          meta={meta}
          onComplete={() => setMemoryReady(true)}
        />
      )}

      {/* Messages */}
      {memoryReady && <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isEmpty && !streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: meta.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {meta.emoji}
            </div>
            <h2 style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 18, marginBottom: 4 }}>Chat with {meta.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 280, lineHeight: 1.6, marginBottom: 24 }}>{meta.tagline}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360 }}>
              {agents.slice(0, 3).map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(agent)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px', fontSize: 14, color: 'var(--text-1)', fontWeight: 500, cursor: 'pointer', transition: 'all 120ms', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <span style={{ fontSize: 16 }}>{agent.icon}</span>
                  <span>{agent.label}</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ color: 'var(--border-strong)', marginLeft: 'auto' }}>
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} accentBg={meta.accentBg} />
        ))}

        {streaming && messages.at(-1)?.content === '' && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>}

      {/* Input — hidden during onboarding */}
      {memoryReady && <div style={{ padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', borderTop: '1px solid var(--border)', background: 'var(--sidebar-bg)', flexShrink: 0 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '4px 4px 4px 12px' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            onFocus={e => {
              const form = e.currentTarget.closest('form') as HTMLFormElement | null
              if (form) { form.style.borderColor = 'var(--neon-indigo)'; form.style.boxShadow = 'var(--glow-indigo)' }
            }}
            onBlur={e => {
              const form = e.currentTarget.closest('form') as HTMLFormElement | null
              if (form) { form.style.borderColor = 'var(--border-strong)'; form.style.boxShadow = 'none' }
            }}
            placeholder={`Ask ${meta.name} anything…`}
            rows={1}
            disabled={streaming}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'none', lineHeight: 1.6, minHeight: '42px', maxHeight: '120px', opacity: streaming ? 0.5 : 1, fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--font-sans)' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            style={{
              width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed', transition: 'all 150ms',
              background: input.trim() && !streaming ? meta.accentBg : 'var(--surface-3)',
              color: input.trim() && !streaming ? '#fff' : 'var(--text-3)',
            }}
            onMouseEnter={e => { if (input.trim() && !streaming) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {streaming ? (
              <svg className="animate-spin" viewBox="0 0 24 24" fill="none" width="16" height="16">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            )}
          </button>
        </form>
      </div>}

      {/* Agent modal */}
      {activeAgent && (
        <AgentModal
          agent={activeAgent}
          assistantName={meta.name}
          accentBg={meta.accentBg}
          onClose={() => setActiveAgent(null)}
          onSubmit={handleAgentSubmit}
        />
      )}
    </div>
  )
}
