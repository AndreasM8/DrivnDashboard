import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import JoinPageClient from './JoinPageClient'

// Service-role client for reading invite tokens (public route)
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: member } = await adminSupabase
    .from('team_members')
    .select('id, name, email, role, status, invite_expires_at, coach_id')
    .eq('invite_token', token)
    .maybeSingle()

  if (!member) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>🔗</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>Invalid invite link</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>This link may have expired or already been used.</p>
        </div>
      </div>
    )
  }

  if (member.status === 'active') {
    redirect('/dashboard')
  }

  const expired = new Date(member.invite_expires_at as string) < new Date()
  if (expired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>⏰</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>Invite link expired</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Ask your coach to generate a new link.</p>
        </div>
      </div>
    )
  }

  // Fetch coach name
  const { data: coach } = await adminSupabase
    .from('users')
    .select('name, business_name')
    .eq('id', member.coach_id as string)
    .single()

  return (
    <JoinPageClient
      token={token}
      memberName={member.name as string}
      memberEmail={member.email as string}
      role={member.role as 'setter' | 'closer'}
      coachName={(coach?.business_name as string | null) || (coach?.name as string | null) || 'Your coach'}
    />
  )
}
