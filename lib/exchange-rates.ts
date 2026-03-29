import { createServerSupabaseClient } from './supabase-server'

const BASE_URL = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest`
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface RateCache {
  base: string
  rates: Record<string, number>
  fetched_at: string
}

// ─── Fetch rates (with 1-hour Supabase cache) ─────────────────────────────────

export async function getRates(base: string): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient()

  // Check cache
  const { data: cached } = await supabase
    .from('exchange_rate_cache')
    .select('*')
    .eq('base', base)
    .single()

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime()
    if (age < CACHE_TTL_MS) {
      return cached.rates as Record<string, number>
    }
  }

  // Fetch fresh rates
  const res = await fetch(`${BASE_URL}/${base}`)
  if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`)
  const data = await res.json()
  const rates: Record<string, number> = data.conversion_rates

  // Upsert cache
  await supabase.from('exchange_rate_cache').upsert({
    base,
    rates,
    fetched_at: new Date().toISOString(),
  })

  return rates
}

export async function getRate(from: string, to: string): Promise<number> {
  const rates = await getRates(from)
  return rates[to] ?? 1
}

export async function convertToBase(
  amount: number,
  fromCurrency: string,
  baseCurrency: string
): Promise<number> {
  if (fromCurrency === baseCurrency) return amount
  const rate = await getRate(fromCurrency, baseCurrency)
  return amount * rate
}

