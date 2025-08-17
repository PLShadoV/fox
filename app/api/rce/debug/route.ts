// app/api/rce/debug/route.ts
import type { NextRequest } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Tried = { api: 'v2'|'v1'|'bulk', url: string, ok: boolean, http: number, count: number, sample?: any }

function headers() {
  return {
    'Accept': 'application/json;odata.metadata=minimal',
    'OData-Version': '4.0',
    'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
    'Origin': 'https://raporty.pse.pl',
    'Referer': 'https://raporty.pse.pl/',
    'X-Requested-With': 'XMLHttpRequest',
  }
}

const V2 = 'https://api.raporty.pse.pl/api/rce-pln'
const V1 = 'https://v1.api.raporty.pse.pl/api/rce-pln'

function build(dayStr: string) {
  const day = new Date(`${dayStr}T00:00:00Z`)
  const next = new Date(day.getTime() + 24 * 3600_000)
  const fromIso = day.toISOString().replace('.000Z', 'Z')
  const toIso = next.toISOString().replace('.000Z', 'Z')

  const sel = `$select=period_utc,rce_pln&$orderby=period_utc%20asc&$top=500`
  const q = (f: string) => `${sel}&$filter=${encodeURIComponent(f)}`
  const v2 = [
    { api: 'v2' as const, url: `${V2}?${q(`business_date eq '${dayStr}'`)}` },
    { api: 'v2' as const, url: `${V2}?${q(`doba eq '${dayStr}'`)}` },
    { api: 'v2' as const, url: `${V2}?${q(`udtczas ge '${dayStr} 00:00' and udtczas le '${dayStr} 23:59'`)}` },
    { api: 'v2' as const, url: `${V2}?${q(`period_utc ge ${`datetimeoffset'${fromIso}'`} and period_utc le ${`datetimeoffset'${toIso}'`}`)}` },
  ]
  const v1 = [
    { api: 'v1' as const, url: `${V1}?${q(`doba eq '${dayStr}'`)}` },
    { api: 'v1' as const, url: `${V1}?${q(`udtczas_oreb ge '${dayStr} 00:00' and udtczas_oreb le '${dayStr} 23:59'`)}` },
    { api: 'v1' as const, url: `${V1}?${q(`period_utc ge ${`datetimeoffset'${fromIso}'`} and period_utc le ${`datetimeoffset'${toIso}'`}`)}` },
  ]
  const bulk = [
    { api: 'bulk' as const, url: `${V2}?$select=period_utc,rce_pln&$orderby=period_utc%20desc&$top=2000` },
    { api: 'bulk' as const, url: `${V1}?$select=period_utc,rce_pln&$orderby=period_utc%20desc&$top=2000` },
  ]
  return [...v2, ...v1, ...bulk]
}

function pickRows(body: any) {
  if (!body) return []
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.value)) return body.value
  return []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = searchParams.get('day') || new Date().toISOString().slice(0,10)
  const urls = build(day)

  const tried: Tried[] = []
  for (const u of urls) {
    try {
      const r = await fetch(u.url, { headers: headers(), method: 'GET', next: { revalidate: 60 } })
      const text = await r.text()
      let body: any = null
      try { body = JSON.parse(text) } catch { body = null }
      const rows = pickRows(body)
      tried.push({ api: u.api, url: u.url, ok: r.ok, http: r.status, count: rows.length, sample: rows[0] })
      if (r.ok && rows.length) break
    } catch (e: any) {
      tried.push({ api: u.api, url: u.url, ok: false, http: 0, count: 0, sample: String(e?.message || e) })
    }
  }

  // najnowsze „udane” podejście
  const ok = tried.find(t => t.ok && t.count > 0)
  return new Response(JSON.stringify({ ok: true, day, tried, sample: ok?.sample ?? null }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
