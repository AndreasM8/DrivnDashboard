import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
}

export async function embedText(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

export async function getKnowledgeContext(
  assistant: string,
  query: string,
  limit = 5,
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) return ''
    const embedding = await embedText(query)
    const supabase = await createServerSupabaseClient()

    const { data } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_assistant: assistant,
      match_threshold: 0.5,
      match_count: limit,
    })

    if (!data || data.length === 0) return ''

    return data
      .map((chunk: { source_title: string; content: string }) =>
        `[${chunk.source_title}]\n${chunk.content}`,
      )
      .join('\n\n---\n\n')
  } catch {
    // Knowledge base is optional — don't fail the whole request
    return ''
  }
}
