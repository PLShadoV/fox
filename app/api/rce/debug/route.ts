// app/api/rce/debug/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_V2 = process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl'

function ymdWarsaw(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const y = p.find(x => x.type === 'year')!.value
  const m = p.find(x => x.type === 'month')!.value
  const day = p.find(x => x.type === 'day')!.value
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = searchParams.get('day') || ymdWarsaw(new Date())
  // budujemy ręcznie, żeby spacje były %20
  const filter = encodeURIComponent(`doba eq '${day}'`)
  const url = `${BASE_V2}/api/rce-pln?$filter=${filter}&$orderby=${encodeURIComponent('period_utc asc')}&$top=500`

  let http = 0, count = 0, sample: any[] = []
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 60 } })
    http = res.status
    const js = await res.json()
    const arr: any[] = Array.isArray(js?.value) ? js.value : []
    count = arr.length
    sample = arr.slice(0, 3)
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, day, url, error: e?.message || 'rce debug error' }, null, 2), {
      status: 500, headers: { 'content-type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ ok: true, api: 'v2', day, http, url, count, sample }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
