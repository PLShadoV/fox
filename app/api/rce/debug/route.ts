// app/api/rce/debug/route.ts
export const runtime = 'edge'
// Preferencja na EU IP (pomaga, jeśli API PSE “kręci nosem” na USA)
export const preferredRegion = ['waw1', 'fra1', 'arn1']
export const dynamic = 'force-dynamic'

type Tried = { api: string; url: string; ok: boolean; http: number; count: number }

const COMMON_HEADERS: Record<string, string> = {
  'accept': 'application/json',
  'OData-Version': '4.0',
  'OData-MaxVersion': '4.0',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36'
}

function plDateString(d: Date) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: COMMON_HEADERS, cache: 'no-store' })
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : [])
    return { ok: res.ok, http: res.status, count: arr.length, sample: arr.slice(0, 2) }
  } catch {
    return { ok: false, http: res.status, count: 0, sample: text.slice(0, 200) }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const day = url.searchParams.get('day') || plDateString(new Date())

  const variants = [
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=business_date eq '${day}'` },
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=doba eq '${day}'` },
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=udtczas ge '${day} 00:00' and udtczas le '${day} 23:59'` },
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc lt datetimeoffset'${day}T24:00:00Z'` },
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=doba eq '${day}'` },
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=udtczas_oreb ge '${day} 00:00' and udtczas_oreb le '${day} 23:59'` },
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc lt datetimeoffset'${day}T24:00:00Z'` },
    { api: 'bulk', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000` },
    { api: 'bulk', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000` },
  ]

  const tried: Tried[] = []
  for (const v of variants) {
    const r = await fetchJson(v.url)
    tried.push({ api: v.api, url: v.url, ok: r.ok, http: r.http, count: r.count })
    // jeśli to nie “bulk” i mamy dane – dalej nie próbujemy
    if (v.api !== 'bulk' && r.ok && r.count > 0) break
  }

  return new Response(JSON.stringify({ ok: true, day, tried }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
