import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import AssistantPageClient from './AssistantPageClient'

const VALID_ASSISTANTS = ['andreas', 'sebastian'] as const
type AssistantSlug = typeof VALID_ASSISTANTS[number]

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ assistant: string }>
}) {
  const { assistant } = await params

  if (!VALID_ASSISTANTS.includes(assistant as AssistantSlug)) {
    notFound()
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load last 30 days of conversation history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: history } = await supabase
    .from('assistant_conversations')
    .select('role, content, agent_used, created_at')
    .eq('user_id', user.id)
    .eq('assistant', assistant)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })
    .limit(100)

  const messages = (history ?? []).map(row => ({
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
  }))

  return (
    <AssistantPageClient
      assistant={assistant as AssistantSlug}
      initialMessages={messages}
    />
  )
}
