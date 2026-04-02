import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { embedText } from '@/lib/assistants/knowledge'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { assistant, source_title, source_type, content } = await req.json() as {
    assistant: string
    source_title: string
    source_type: string
    content: string
  }

  if (!assistant || !content) {
    return Response.json({ error: 'assistant and content required' }, { status: 400 })
  }

  try {
    const embedding = await embedText(content)

    const { error } = await supabase.from('knowledge_chunks').insert({
      assistant,
      source_title: source_title ?? 'Untitled',
      source_type: source_type ?? 'manual',
      content,
      embedding,
    })

    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to embed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
