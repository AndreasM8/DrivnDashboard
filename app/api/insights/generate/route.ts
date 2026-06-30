import Anthropic from '@anthropic-ai/sdk'
import { WEEKLY_INSIGHT_PROMPT } from '@/lib/insights/prompts'
import { getWeeklyInsightContext, getMonday } from '@/lib/insights/context'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  // Auth check
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: max once per hour
  const weekStart = getMonday(new Date())
  const { data: existing } = await supabase
    .from('weekly_insights')
    .select('insight_text, generated_at')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing?.generated_at) {
    const lastGen = new Date(existing.generated_at)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (lastGen > hourAgo) {
      return Response.json({
        insight: existing,
        rateLimited: true,
        nextAllowed: new Date(lastGen.getTime() + 60 * 60 * 1000).toISOString(),
      })
    }
  }

  // Build context using service role for cross-table queries
  const adminClient = createAdminSupabaseClient()
  const context = await getWeeklyInsightContext(user.id, adminClient)

  // Check if enough data
  const hasData = context.cashCollected > 0 || context.callsBooked > 0 || context.newContracts > 0
  if (!hasData) {
    const emptyText = "Not enough data yet to generate an insight — check back after your first full week of activity."
    await supabase.from('weekly_insights').upsert({
      user_id: user.id,
      week_start: weekStart,
      insight_text: emptyText,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    return Response.json({ insight: { insight_text: emptyText, generated_at: new Date().toISOString() } })
  }

  const prompt = WEEKLY_INSIGHT_PROMPT.replace('{DATA_CONTEXT}', JSON.stringify(context, null, 2))

  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const insightText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

  const { data: saved } = await supabase
    .from('weekly_insights')
    .upsert({
      user_id: user.id,
      week_start: weekStart,
      insight_text: insightText,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    .select()
    .maybeSingle()

  return Response.json({ insight: saved })
}
