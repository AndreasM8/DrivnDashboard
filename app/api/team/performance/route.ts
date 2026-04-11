import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TeamMember } from '@/types'

export interface EodReportRow {
  id: string
  team_member_id: string
  date: string
  answers: Array<{ question_id: string; label: string; value: string }>
}

export interface NonnegCompletion {
  team_member_id: string
  non_neg_id: string
  date: string
}

export interface PerformanceResponse {
  members: TeamMember[]
  eodReports: EodReportRow[]
  nonnegCompletions: NonnegCompletion[]
  nonnegCounts: Record<string, number>
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10), 1), 90)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // 1. Active team members
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .order('created_at')

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  const memberIds = (members ?? []).map((m: TeamMember) => m.id)

  if (memberIds.length === 0) {
    const body: PerformanceResponse = { members: [], eodReports: [], nonnegCompletions: [], nonnegCounts: {} }
    return NextResponse.json(body)
  }

  // 2. EOD reports for last N days
  const { data: eodRaw, error: eodError } = await supabase
    .from('team_eod_reports')
    .select('id, team_member_id, date, answers')
    .eq('coach_id', user.id)
    .gte('date', cutoffStr)
    .in('team_member_id', memberIds)
    .order('date', { ascending: false })

  if (eodError) return NextResponse.json({ error: eodError.message }, { status: 500 })

  // 3. Non-neg completions — join via non_negs to get team_member_id
  const { data: nonNegsRaw } = await supabase
    .from('team_non_negotiables')
    .select('id, team_member_id')
    .in('team_member_id', memberIds)

  const nonNegIds = (nonNegsRaw ?? []).map((n: { id: string; team_member_id: string }) => n.id)
  const nonNegMemberMap: Record<string, string> = {}
  for (const n of nonNegsRaw ?? []) {
    nonNegMemberMap[n.id] = n.team_member_id
  }

  let completions: NonnegCompletion[] = []
  if (nonNegIds.length > 0) {
    const { data: completionsRaw } = await supabase
      .from('team_nonneg_completions')
      .select('team_member_id, non_neg_id, date')
      .in('non_neg_id', nonNegIds)
      .gte('date', cutoffStr)

    completions = (completionsRaw ?? []).map((c: { team_member_id: string; non_neg_id: string; date: string }) => ({
      team_member_id: c.team_member_id ?? nonNegMemberMap[c.non_neg_id] ?? '',
      non_neg_id: c.non_neg_id,
      date: c.date,
    }))
  }

  // 4. Total non-neg count per member
  const nonnegCounts: Record<string, number> = {}
  for (const n of nonNegsRaw ?? []) {
    nonnegCounts[n.team_member_id] = (nonnegCounts[n.team_member_id] ?? 0) + 1
  }

  const body: PerformanceResponse = {
    members: (members ?? []) as TeamMember[],
    eodReports: (eodRaw ?? []) as EodReportRow[],
    nonnegCompletions: completions,
    nonnegCounts,
  }

  return NextResponse.json(body)
}
