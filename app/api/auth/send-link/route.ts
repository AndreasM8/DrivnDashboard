import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://drivn-dashboard-2gzs.vercel.app').replace(/[./\s]+$/, '')

    // Generate a real (non-PKCE) magic link via admin API
    // No redirectTo — we build our own verify URL from the token hash
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (error) {
      console.error('generateLink error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const tokenHash = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
    if (!tokenHash) {
      return NextResponse.json({ error: 'Could not generate login link' }, { status: 500 })
    }

    const verifyUrl = `${appUrl}/auth/verify?token_hash=${tokenHash}&type=magiclink`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Drivn <onboarding@resend.dev>',
        to: email,
        subject: 'Sign in to Drivn',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Sign in to Drivn</h2>
            <p style="color:#6b7280;margin-bottom:24px">Click the button below to sign in. This link expires in 1 hour.</p>
            <a href="${verifyUrl}"
               style="display:inline-block;background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Sign in to Drivn
            </a>
            <p style="color:#9ca3af;font-size:13px;margin-top:24px">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      const body = await resendRes.text()
      console.error('Resend error:', body)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-link error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
