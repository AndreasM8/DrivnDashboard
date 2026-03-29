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

  return NextResponse.json({
    zapier: {
      configured: !!(
        process.env.ZAPIER_WEBHOOK_SECRET &&
        process.env.ZAPIER_WEBHOOK_SECRET !== 'your_zapier_webhook_secret'
      ),
      webhook_url: `${appUrl}/api/webhooks/zapier`,
    },
    stripe: {
      configured: stripeConnected,
      webhook_url: `${appUrl}/api/webhooks/stripe`,
    },
  })
}
