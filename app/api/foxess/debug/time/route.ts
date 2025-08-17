// app/api/debug/time/route.ts
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rozbija chwilę na składniki w zadanej strefie
function partsInTZ(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
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

function warsawBoundsISO(date = new Date()) {
  const p = partsInTZ(date, 'Europe/Warsaw')
  const start = new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0))
  const end   = new Date(Date.UTC(p.year, p.month - 1, p.day, 23, 59, 59, 999))
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

export async function GET(_req: NextRequest) {
  const now = new Date()
  const warsaw = partsInTZ(now, 'Europe/Warsaw')
  const { startISO, endISO } = warsawBoundsISO(now)

  return new Response(JSON.stringify({
    serverNowUTC_iso: now.toISOString(),
    warsawNow: warsaw,
    todayWarsaw_from_iso: startISO,
    todayWarsaw_to_iso: endISO,
    note: 'Zakres „Dziś” i doby liczymy według Europe/Warsaw.',
  }, null, 2), { headers: { 'content-type': 'application/json' } })
}
