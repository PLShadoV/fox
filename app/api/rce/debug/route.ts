// app/api/rce/debug/route.ts
import { NextRequest } from 'next/server'
import { __rce_internal } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = (searchParams.get('day') || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Response(JSON.stringify({ ok: false, error: "Podaj ?day=YYYY-MM-DD" }, null, 2), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const v2urls = __rce_internal.buildV2DayUrls(day)
  const v1urls = __rce_internal.buildV1DayUrls(day)
  const bulk = __rce_internal.buildBulkUrls()

  const tried: any[] = []
  // v2
  for (const url of v2urls) {
    const r = await fetch(url, { headers: { accept: 'application/json' }})
    const http = r.status
    let count = 0
    try {
      const j = await r.json()
      count = Array.isArray(j?.value) ? j.value.length : 0
    } catch { /* ignore */ }
    tried.push({ api: 'v2', url, ok: r.ok, http, count })
    if (count) break
  }
  // v1 (jeśli v2 puste)
  if (!tried.some(t => t.api === 'v2' && t.count > 0)) {
    for (const url of v1urls) {
      const r = await fetch(url, { headers: { accept: 'application/json' }})
      const http = r.status
      let count = 0
      try {
        const j = await r.json()
        count = Array.isArray(j?.value) ? j.value.length : 0
      } catch { /* ignore */ }
      tried.push({ api: 'v1', url, ok: r.ok, http, count })
      if (count) break
    }
  }
  // bulk (jeśli nadal pusto)
  if (!tried.some(t => t.count > 0)) {
    for (const url of bulk) {
      const r = await fetch(url, { headers: { accept: 'application/json' }})
      const http = r.status
      let count = 0
      try {
        const j = await r.json()
        count = Array.isArray(j?.value) ? j.value.length : 0
      } catch { /* ignore */ }
      tried.push({ api: 'bulk', url, ok: r.ok, http, count })
      if (count) break
    }
  }

  // zademonstruj 3 pierwsze rekordy po odfiltrowaniu do tej doby (UTC)
  let sample: any[] = []
  try {
    const firstHit = tried.find(t => t.count > 0)
    if (firstHit) {
      const r = await fetch(firstHit.url, { headers: { accept: 'application/json' }})
      const j = await r.json()
      const rows: any[] = Array.isArray(j?.value) ? j.value : []
      sample = rows.slice(0, 3)
    }
  } catch {}

  return new Response(JSON.stringify({
    ok: true,
    day,
    tried,
    hint: "Jeśli wszystkie http==400, serwer odrzuca filtr – wtedy fallback 'bulk' powinien zwrócić ostatnie rekordy, a /api/data je odetnie do zakresu.",
    sample
  }, null, 2), { headers: { 'content-type': 'application/json' }})
}
