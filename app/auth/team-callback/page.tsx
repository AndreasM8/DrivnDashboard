import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function TeamCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Link this user to the team_member record
  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (member && member.status === 'invited') {
    await adminSupabase
      .from('team_members')
      .update({ user_id: user.id, status: 'active' })
      .eq('id', member.id as string)
  }

  redirect('/team-dashboard')
}
