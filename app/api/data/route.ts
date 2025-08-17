// app/api/data/route.ts
import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'
import { fetchRcePlnHourly } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function partsInWarsaw(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day'), H: get('hour') }
}
function warsawDayBoundsISO(dt: Date) {
  const { y, m, d } = partsInWarsaw(dt)
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString()
  const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString()
  return { start, end }
}
function enumerateWarsawMidnights(fromISO: string, toISO: string) {
  const from = new Date(fromISO)
  const to   = new Date(toISO)
  const days: string[] = []
  let cursor = new Date(warsawDayBoundsISO(from).start)
  const last  = new Date(warsawDayBoundsISO(to).start)
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString())
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return days
}
function clampRows<T extends { ts: string }>(rows: T[], fromISO: string, toISO: string): T[] {
  const a = new Date(fromISO).getTime()
  const b = new Date(toISO).getTime()
  return rows.filter(r => {
    const t = new Date(r.ts).getTime()
    return t >= a && t <= b
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const def = warsawDayBoundsISO(now)
    const from = searchParams.get('from') || def.start
    const to   = searchParams.get('to')   || def.end

    // 1) FoxESS – kWh per godzina
    const dayStarts = enumerateWarsawMidnights(from, to)
    let energy: { ts: string; kwh: number }[] = []
    for (const dayStart of dayStarts) {
      const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 3600 * 1000 - 1).toISOString()
      const points = await fetchFoxEssHourlyExported(dayStart, dayEnd)
      energy.push(...points.map(p => ({ ts: p.timestamp, kwh: Number(p.exported_kwh || 0) })))
    }
    energy = clampRows(energy, from, to)
    energy.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    // 2) RCE – PLN/kWh per godzina (z API PSE)
    const rceMap = await fetchRcePlnHourly(from, to) // Map<ISO hour, PLN/kWh>

    // 3) Merge → dodaj price + revenue
    const rows = energy.map(e => {
      const price = rceMap.get(e.ts) ?? 0
      const revenue = price * e.kwh
      return { ts: e.ts, kwh: e.kwh, price, revenue }
    })

    return new Response(JSON.stringify({ ok: true, rows }, null, 2), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'data error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
