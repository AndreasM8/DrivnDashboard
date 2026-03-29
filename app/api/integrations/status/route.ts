import { NextResponse } from 'next/server'

// Returns which integrations are configured (env vars present).
// Never exposes secret values — only boolean status.

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.com'

  return NextResponse.json({
    zapier: {
      configured: !!(
        process.env.ZAPIER_WEBHOOK_SECRET &&
        process.env.ZAPIER_WEBHOOK_SECRET !== 'your_zapier_webhook_secret'
      ),
      webhook_url: `${appUrl}/api/webhooks/zapier`,
    },
    stripe: {
      configured: !!(process.env.STRIPE_WEBHOOK_SECRET),
      webhook_url: `${appUrl}/api/webhooks/stripe`,
    },
  })
}
