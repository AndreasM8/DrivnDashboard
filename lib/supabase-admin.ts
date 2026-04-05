// Server-only — never import from client code.
// Uses the service role key to bypass RLS (e.g. reading auth.users for last login).
import { createClient } from '@supabase/supabase-js'

export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
