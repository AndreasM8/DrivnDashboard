import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AssistantMemory } from '@/lib/assistants/memory'

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json() as { assistant: string } & Partial<AssistantMemory>
  const { assistant, ...fields } = body

  if (!assistant) return new Response('Missing assistant', { status: 400 })

  await supabase
    .from('assistant_memory')
    .upsert(
      { user_id: user.id, assistant, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,assistant' },
    )

  return new Response('OK')
}
