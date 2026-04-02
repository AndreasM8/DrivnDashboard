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
  gradient: string
  accentBg: string
  accentText: string
}> = {
  andreas: {
    name: 'Andreas',
    emoji: '🎯',
    tagline: 'Content, brand & Instagram growth',
    gradient: 'from-orange-400 to-orange-600',
    accentBg: 'bg-orange-500',
    accentText: 'text-orange-600',
  },
  sebastian: {
    name: 'Sebastian',
    emoji: '💼',
    tagline: 'Sales, DMs & closing clients',
    gradient: 'from-blue-500 to-blue-700',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-600',
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
    // Build the prompt by replacing placeholders
    let prompt = agent.prompt
    for (const [key, val] of Object.entries(values)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
    }
    onSubmit(values)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${accentBg} px-5 py-4 flex items-center gap-3`}>
          <span className="text-2xl">{agent.icon}</span>
          <div>
            <p className="font-bold text-white text-sm">{agent.label}</p>
            <p className="text-xs text-white/80">{agent.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {agent.fields.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  required
                />
              ) : field.type === 'select' ? (
                <select
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
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
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  required
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 rounded-xl ${accentBg} text-white text-sm font-semibold hover:opacity-90 transition-opacity`}
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
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant message — render with basic markdown-like formatting
  const formatted = message.content
    .split('\n')
    .map((line, i) => {
      // Bold **text**
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <p key={i} className={line === '' ? 'h-3' : 'leading-relaxed'}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
          )}
        </p>
      )
    })

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 shadow-sm">
        <div className="space-y-0.5">{formatted}</div>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssistantPageClient({
  assistant,
  initialMessages,
}: {
  assistant: AssistantSlug
  initialMessages: ChatMessage[]
}) {
  const meta = ASSISTANT_META[assistant]
  const agents = ALL_AGENTS[assistant]

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link
          href="/ask"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-lg flex-shrink-0`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-none">{meta.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.tagline}</p>
        </div>
        {/* Agent tools button */}
        <button
          onClick={() => setShowAgents(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            showAgents ? `${meta.accentBg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
          </svg>
          Tools
        </button>
      </div>

      {/* Agent tools panel */}
      {showAgents && (
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => { setActiveAgent(agent); setShowAgents(false) }}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all whitespace-nowrap flex-shrink-0"
              >
                <span>{agent.icon}</span>
                {agent.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isEmpty && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-3xl mb-4 shadow-md`}>
              {meta.emoji}
            </div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Chat with {meta.name}</h2>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">{meta.tagline}</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {agents.slice(0, 3).map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(agent)}
                  className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium hover:border-gray-300 hover:shadow-sm transition-all text-left"
                >
                  <span className="text-base">{agent.icon}</span>
                  <span>{agent.label}</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 ml-auto">
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
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${meta.name} anything…`}
            rows={1}
            disabled={streaming}
            className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
              input.trim() && !streaming
                ? `${meta.accentBg} text-white hover:opacity-90`
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            {streaming ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            )}
          </button>
        </form>
      </div>

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
