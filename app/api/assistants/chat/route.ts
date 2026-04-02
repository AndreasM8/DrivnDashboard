import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ANDREAS_PERSONA, SEBASTIAN_PERSONA } from '@/lib/assistants/personas'
import { getUserMemory, formatMemoryForPrompt, updateMemoryAfterConversation } from '@/lib/assistants/memory'
import { getKnowledgeContext } from '@/lib/assistants/knowledge'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
}

const PERSONAS: Record<string, string> = {
  andreas: ANDREAS_PERSONA,
  sebastian: SEBASTIAN_PERSONA,
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { assistant, messages, agentPrompt } = await req.json() as {
    assistant: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    agentPrompt?: string
  }

  if (!PERSONAS[assistant]) return new Response('Unknown assistant', { status: 400 })

  // Fetch memory and knowledge in parallel
  const lastUserMessage = messages.findLast(m => m.role === 'user')?.content ?? ''
  const [memory, knowledgeContext] = await Promise.all([
    getUserMemory(user.id, assistant),
    getKnowledgeContext(assistant, lastUserMessage),
  ])

  const memoryText = formatMemoryForPrompt(memory)

  // Build system prompt
  let systemPrompt = PERSONAS[assistant]
    .replace('{USER_MEMORY}', memoryText)
    .replace('{KNOWLEDGE_CONTEXT}', knowledgeContext || 'No specific knowledge base excerpts for this question.')

  // If this is an agent tool call, prepend the agent prompt as a system instruction
  const apiMessages = agentPrompt
    ? [{ role: 'user' as const, content: agentPrompt }]
    : messages

  // Save user message to DB (fire and forget)
  const latestUserMsg = messages.at(-1)
  if (latestUserMsg?.role === 'user') {
    supabase.from('assistant_conversations').insert({
      user_id: user.id,
      assistant,
      role: 'user',
      content: latestUserMsg.content,
    }).then(() => {})
  }

  // Stream response
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = getAnthropic().messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: apiMessages,
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            fullResponse += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        // After streaming, save assistant message + trigger memory update (non-blocking)
        supabase.from('assistant_conversations').insert({
          user_id: user.id,
          assistant,
          role: 'assistant',
          content: fullResponse,
          agent_used: agentPrompt ? 'agent' : null,
        }).then(() => {})

        // Update memory async — only for regular conversations, not agent tool calls
        if (!agentPrompt && messages.length >= 2) {
          updateMemoryAfterConversation(user.id, assistant, [
            ...messages,
            { role: 'assistant', content: fullResponse },
          ]).catch(() => {})
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
