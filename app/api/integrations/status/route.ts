import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.com'
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let stripeConnected = false
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('stripe_connected')
      .eq('id', user.id)
      .single()
    stripeConnected = data?.stripe_connected ?? false
  }

  const zapierBase = `${appUrl}/api/webhooks/zapier`
  const zapierUrl = user ? `${zapierBase}?uid=${user.id}` : zapierBase
  const secret = process.env.ZAPIER_WEBHOOK_SECRET ?? ''
  const secretConfigured = !!(secret && secret !== 'your_zapier_webhook_secret')

  return NextResponse.json({
    zapier: {
      configured: secretConfigured,
      webhook_url: zapierUrl,
      // Return last 8 chars of secret so UI can show it (owner-only endpoint)
      webhook_secret: secretConfigured ? secret : null,
    },
    stripe: {
      configured: stripeConnected,
      webhook_url: `${appUrl}/api/webhooks/stripe`,
    },
  })
}
