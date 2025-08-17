// app/api/data/route.ts
import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'
import { fetchRcePlnHourly } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// cache 60 s po kluczu zakresu
type Row = { ts: string; kwh: number; price: number; revenue: number }
const DATA_TTL_MS = 60_000
const g = globalThis as any
g.__data_cache ||= new Map<string, { ts: number; rows: Row[]; meta?: any }>()

function partsPL(date: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(p.find(x => x.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}
function dayBoundsPL(dt: Date) {
  const { y, m, d } = partsPL(dt)
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString(),
    end:   new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString(),
  }
}
function enumerateMidnightsPL(fromISO: string, toISO: string) {
  const from = new Date(fromISO); const to = new Date(toISO)
  const list: string[] = []
  let cur = new Date(dayBoundsPL(from).start)
  const last = new Date(dayBoundsPL(to).start)
  while (cur.getTime() <= last.getTime()) { list.push(cur.toISOString()); cur = new Date(cur.getTime() + 24*3600*1000) }
  return list
}
function clamp<T extends { ts: string }>(rows: T[], fromISO: string, toISO: string) {
  const a = new Date(fromISO).getTime(), b = new Date(toISO).getTime()
  return rows.filter(r => { const t = new Date(r.ts).getTime(); return t >= a && t <= b })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const def = dayBoundsPL(now)
    const from = searchParams.get('from') || def.start
    const to   = searchParams.get('to')   || def.end
    const debug = searchParams.get('debug')

    const key = `${from}|${to}`
    const cached = g.__data_cache.get(key)
    if (cached && Date.now() - cached.ts < DATA_TTL_MS) {
      return new Response(JSON.stringify({ ok: true, rows: cached.rows, meta: cached.meta }, null, 2), {
        headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
      })
    }

    // 1) energia z FoxESS (dzień po dniu)
    const dayStarts = enumerateMidnightsPL(from, to)
    let energy: { ts: string; kwh: number }[] = []
    for (const dayStart of dayStarts) {
      const dayEnd = new Date(new Date(dayStart).getTime() + 24*3600*1000 - 1).toISOString()
      const points = await fetchFoxEssHourlyExported(dayStart, dayEnd)
      energy.push(...points.map(p => ({ ts: p.timestamp, kwh: Number(p.exported_kwh || 0) })))
    }
    energy = clamp(energy, from, to)
    energy.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    // 2) ceny RCE dla tego samego zakresu
    const rce = await fetchRcePlnHourly(from, to) // Map<ISOhour, PLN/kWh>

    // 3) merge
    const rows: Row[] = energy.map(e => {
      const price = rce.get(e.ts) ?? 0
      return { ts: e.ts, kwh: e.kwh, price, revenue: price * e.kwh }
    })

    const meta = debug ? { rceKeys: rce.size, sampleTs: rows.slice(0, 3).map(r => r.ts) } : undefined
    g.__data_cache.set(key, { ts: Date.now(), rows, meta })

    return new Response(JSON.stringify({ ok: true, rows, meta }, null, 2), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'data error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
