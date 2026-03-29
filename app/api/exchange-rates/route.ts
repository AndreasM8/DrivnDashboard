import { NextRequest, NextResponse } from 'next/server'
import { getRate } from '@/lib/exchange-rates'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to params' }, { status: 400 })
  }

  try {
    const rate = await getRate(from, to)
    return NextResponse.json({ rate }, {
      headers: {
        // Cache for 1 hour
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('Exchange rate error:', err)
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 })
  }
}
