// app/api/debug/time/route.ts
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rozbija chwilę na składniki w zadanej strefie czasowej
function partsInTZ(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

// ISO dla północy i końca dnia w strefie Europe/Warsaw (jako instants UTC)
function warsawDayBoundsISO(date = new Date()) {
  const { year, month, day } = partsInTZ(date, 'Europe/Warsaw')
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const end   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

export async function GET(_req: NextRequest) {
  const now = new Date()
  const warsaw = partsInTZ(now, 'Europe/Warsaw')
  const { startISO, endISO } = warsawDayBoundsISO(now)

  return new Response(JSON.stringify({
    serverNowUTC_iso: now.toISOString(),
    warsawNow: warsaw,               // np. hour: 9, minute: 8 (dla 09:08 w PL)
    todayWarsaw_from_iso: startISO,  // 00:00:00.000 czasu PL jako instant
    todayWarsaw_to_iso: endISO,      // 23:59:59.999 czasu PL jako instant
    note: 'Zakres „Dziś” w aplikacji liczymy dokładnie tak samo – po dobie Europe/Warsaw.'
  }, null, 2), { headers: { 'content-type': 'application/json' } })
}
