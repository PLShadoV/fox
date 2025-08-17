// app/api/rce/debug/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const API_BASE = process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl/api'

function ymd(d = new Date()) {
  // domyślnie dziś w PL; pozwalamy też na ?day=YYYY-MM-DD
  const tz = 'Europe/Warsaw'
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = (searchParams.get('day') || ymd()).trim()

  const params = new URLSearchParams()
  params.set('$select', 'period_utc,rce_pln')
  params.set('$orderby', 'period_utc asc')
  params.set('$top', '500')
  params.set('$filter', `udtczas ge '${day} 00:00' and udtczas le '${day} 23:59'`)

  const url = `${API_BASE}/rce-pln?${params.toString()}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 0 } })
  const http = res.status
  let json: any = null
  try { json = await res.json() } catch { json = null }

  const value = Array.isArray(json?.value) ? json.value : []
  return new Response(JSON.stringify({
    ok: true,
    api: 'v2',
    day,
    http,
    url,
    count: value.length,
    sample: value.slice(0, 3)
  }, null, 2), { headers: { 'content-type': 'application/json' } })
}
