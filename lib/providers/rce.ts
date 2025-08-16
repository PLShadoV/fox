import { PricePoint } from '../types'

export async function fetchRceHourlyPrices(fromISO: string, toISO: string): Promise<PricePoint[]> {
  // Prefer our internal PSE route for stability
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const url = new URL(`/api/rce/pse`, base)
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`RCE fetch failed: ${res.status}`)
  return await res.json() as PricePoint[]
}
