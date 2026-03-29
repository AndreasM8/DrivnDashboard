// Client-safe exchange rate helpers (call our API route, not Supabase directly)

export async function getLiveRate(from: string, to: string): Promise<number> {
  const res = await fetch(`/api/exchange-rates?from=${from}&to=${to}`)
  if (!res.ok) return 1
  const data = await res.json()
  return data.rate ?? 1
}
