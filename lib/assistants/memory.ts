import { createServerSupabaseClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import { MEMORY_EXTRACTION_PROMPT } from './personas'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
}

export interface AssistantMemory {
  niche: string | null
  target_audience: string | null
  revenue_range: string | null
  content_challenges: string | null
  sales_challenges: string | null
  what_works: string | null
  what_doesnt: string | null
  brand_voice: string | null
  key_facts: string | null
}

export function formatMemoryForPrompt(memory: AssistantMemory | null): string {
  if (!memory) return 'No information recorded yet about this coach.'

  const parts: string[] = []
  if (memory.niche)              parts.push(`Niche: ${memory.niche}`)
  if (memory.target_audience)    parts.push(`Target audience: ${memory.target_audience}`)
  if (memory.revenue_range)      parts.push(`Revenue / goals: ${memory.revenue_range}`)
  if (memory.content_challenges) parts.push(`Content challenges: ${memory.content_challenges}`)
  if (memory.sales_challenges)   parts.push(`Sales challenges: ${memory.sales_challenges}`)
  if (memory.what_works)         parts.push(`What's working: ${memory.what_works}`)
  if (memory.what_doesnt)        parts.push(`What's not working: ${memory.what_doesnt}`)
  if (memory.brand_voice)        parts.push(`Brand voice: ${memory.brand_voice}`)
  if (memory.key_facts)          parts.push(`Other key facts: ${memory.key_facts}`)

  return parts.length > 0
    ? parts.join('\n')
    : 'No specific information recorded yet about this coach.'
}

export async function getUserMemory(
  userId: string,
  assistant: string,
): Promise<AssistantMemory | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('assistant_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('assistant', assistant)
    .maybeSingle()
  return (data as AssistantMemory) ?? null
}

export async function updateMemoryAfterConversation(
  userId: string,
  assistant: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  try {
    // Build conversation text for analysis
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Coach' : 'Advisor'}: ${m.content}`)
      .join('\n\n')

    const prompt = MEMORY_EXTRACTION_PROMPT.replace('{CONVERSATION}', conversationText)

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const extracted = JSON.parse(jsonMatch[0]) as AssistantMemory

    // Only update non-null fields to avoid overwriting good data with null
    const updateData: Partial<AssistantMemory> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== null) {
        (updateData as Record<string, string | null>)[key] = value
      }
    }

    if (Object.keys(updateData).length === 0) return

    const supabase = await createServerSupabaseClient()
    await supabase
      .from('assistant_memory')
      .upsert(
        { user_id: userId, assistant, ...updateData, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,assistant' },
      )
  } catch {
    // Memory update is best-effort — never throw
  }
}
