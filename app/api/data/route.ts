// app/api/data/route.ts
import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Rozbija chwilę na komponenty w Europe/Warsaw */
function partsInWarsaw(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day'), H: get('hour'), M: get('minute'), S: get('second') }
}

/** ISO „początek dnia” i „koniec dnia” dla daty w Europe/Warsaw (jako instants UTC) */
function warsawDayBoundsISO(dt: Date) {
  const { y, m, d } = partsInWarsaw(dt)
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString()
  const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString()
  return { start, end }
}

/** Lista północy (PL) dla wszystkich dni w [from..to] (włącznie) */
function enumerateWarsawMidnights(fromISO: string, toISO: string) {
  const from = new Date(fromISO)
  const to   = new Date(toISO)
  const days: string[] = []
  // zacznij od północy dnia 'from' wg PL
  let cursor = new Date(warsawDayBoundsISO(from).start)
  const last  = new Date(warsawDayBoundsISO(to).start)
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString())
    // następny dzień (dodaj 24h po „instancie” UTC)
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return days
}

/** Obcina rekord do zadanego przedziału czasu */
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
    // Domyślnie – DZISIAJ wg czasu PL
    const now = new Date()
    const def = warsawDayBoundsISO(now)

    const from = searchParams.get('from') || def.start
    const to   = searchParams.get('to')   || def.end

    // Zbierzemy FoxESS dla każdego dnia w zakresie (PL), a potem przytniemy do [from..to]
    const dayStarts = enumerateWarsawMidnights(from, to)

    let all: { ts: string; kwh: number }[] = []
    for (const dayStart of dayStarts) {
      const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 3600 * 1000 - 1).toISOString()
      const points = await fetchFoxEssHourlyExported(dayStart, dayEnd)
      // mapujemy do zunifikowanego kształtu
      all.push(...points.map(p => ({ ts: p.timestamp, kwh: Number(p.exported_kwh || 0) })))
    }

    // Przytnij do dokładnego przedziału
    all = clampRows(all, from, to)

    // Posortuj po czasie (na wszelki wypadek)
    all.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    // Zwracamy minimalny zestaw; frontend sam może policzyć revenue z RCE
    return new Response(JSON.stringify({ ok: true, rows: all }, null, 2), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'data error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
