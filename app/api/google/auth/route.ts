import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-sheets'

export async function GET() {
  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
