import { createBrowserClient } from '@supabase/ssr'

// ─── Browser client (for 'use client' components only) ────────────────────────

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit flow avoids PKCE code_verifier stored in localStorage.
        // PKCE breaks when email links open in iOS Mail's in-app browser
        // (separate localStorage context from Safari).
        flowType: 'implicit',
      },
    }
  )
}
