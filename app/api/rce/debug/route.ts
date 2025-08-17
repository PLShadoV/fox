// app/api/rce/debug/route.ts
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TryRec = { api: 'v2' | 'v1'; url: string; ok: boolean; http: number; count: number; note?: string }

function ymdPL(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const Y = parts.find(p => p.type === 'year')!.value
  const M = parts.find(p => p.type === 'month')!.value
  const D = parts.find(p => p.type === 'day')!.value
  return `${Y}-${M}-${D}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = (searchParams.get('day') || ymdPL(new Date())).trim()

  const tried: TryRec[] = []

  // V2
  const base2 = (process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl')
  const u2 = new URL('/api/rce-pln', base2)
  u2.searchParams.set('$filter', `business_date eq '${day}'`)
  u2.searchParams.set('$orderby', 'period_utc asc')
  u2.searchParams.set('$top', '500')

  try {
    const r = await fetch(u2.toString(), { headers: { accept: 'application/json' }, next: { revalidate: 60 } })
    const t = await r.text()
    let json: any = null; try { json = JSON.parse(t) } catch {}
    const arr = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])
    tried.push({ api: 'v2', url: u2.toString(), ok: r.ok, http: r.status, count: Array.isArray(arr) ? arr.length : 0 })
    if (r.ok && Array.isArray(arr) && arr.length) {
      return new Response(JSON.stringify({ ok: true, api: 'v2', day, count: arr.length, tried, sample: arr.slice(0, 3) }, null, 2), {
        headers: { 'content-type': 'application/json' }
      })
    }
  } catch (e: any) {
    tried.push({ api: 'v2', url: u2.toString(), ok: false, http: 0, count: 0, note: e?.message })
  }

  // V1 fallback
  const base1 = 'https://v1.api.raporty.pse.pl'
  const u1 = new URL('/api/rce-pln', base1)
  u1.searchParams.set('$filter', `doba eq '${day}'`)
  u1.searchParams.set('$top', '500')

  try {
    const r = await fetch(u1.toString(), { headers: { accept: 'application/json' }, next: { revalidate: 60 } })
    const t = await r.text()
    let json: any = null; try { json = JSON.parse(t) } catch {}
    const arr = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])
    tried.push({ api: 'v1', url: u1.toString(), ok: r.ok, http: r.status, count: Array.isArray(arr) ? arr.length : 0 })
    return new Response(JSON.stringify({ ok: true, api: 'v1', day, count: Array.isArray(arr) ? arr.length : 0, tried, sample: Array.isArray(arr) ? arr.slice(0, 3) : [] }, null, 2), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (e: any) {
    tried.push({ api: 'v1', url: u1.toString(), ok: false, http: 0, count: 0, note: e?.message })
    return new Response(JSON.stringify({ ok: false, day, tried }, null, 2), {
      status: 500, headers: { 'content-type': 'application/json' }
    })
  }
}
