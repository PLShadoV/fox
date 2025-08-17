// app/api/data/route.ts
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion: string[] = ['waw1', 'fra1', 'arn1']

const TZ = 'Europe/Warsaw'
const FOX_TIMEOUT_MS = 7000
const RCE_TIMEOUT_MS = 7000

type HourRow = {
  timestamp: string
  exported_kwh: number
  rce_pln_per_kwh?: number
  revenue_pln?: number
}

function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(seed)
  const Y = Number(parts.find(p => p.type === 'year')!.value)
  const M = Number(parts.find(p => p.type === 'month')!.value)
  const D = Number(parts.find(p => p.type === 'day')!.value)
  const H = Number(parts.find(p => p.type === 'hour')!.value)
  return new Date(Date.UTC(Y, M - 1, D, H, 0, 0)).toISOString()
}

function parseRange(req: NextRequest): { fromISO: string; toISO: string; dateUsed: string } {
  const { searchParams } = new URL(req.url)
  const qDate = searchParams.get('date') || searchParams.get('day') || searchParams.get('d')
  const qRange = (searchParams.get('range') || '').toLowerCase() // today|yesterday
  if (qDate) {
    const [y,m,d] = qDate.split('-').map(Number)
    return { fromISO: isoForWarsawHour(y, (m||1)-1, d||1, 0), toISO: isoForWarsawHour(y, (m||1)-1, (d||1)+1, 0), dateUsed: qDate }
  }
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  let Y = Number(parts.find(p => p.type === 'year')!.value)
  let M = Number(parts.find(p => p.type === 'month')!.value)
  let D = Number(parts.find(p => p.type === 'day')!.value)
  if (qRange !== 'today') {
    const mid = new Date(Date.UTC(Y, M-1, D, 12)); mid.setUTCDate(mid.getUTCDate()-1)
    Y = mid.getUTCFullYear(); M = mid.getUTCMonth()+1; D = mid.getUTCDate()
  }
  const dayStr = `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`
  return { fromISO: isoForWarsawHour(Y, M-1, D, 0), toISO: isoForWarsawHour(Y, M-1, D+1, 0), dateUsed: dayStr }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

export async function GET(req: NextRequest) {
  const { fromISO, toISO, dateUsed } = parseRange(req)
  const errors: Record<string,string> = {}

  // równolegle; każdy z twardym timeoutem
  const foxPromise = (async () => {
    const { fetchFoxEssHourlyExported } = await import('@/lib/providers/foxess')
    return fetchFoxEssHourlyExported(fromISO, toISO) as Promise<Array<{ timestamp: string; exported_kwh: number }>>
  })()

  const rcePromise = (async () => {
    try {
      const { fetchRceHourlyPln } = await import('@/lib/providers/rce')
      return fetchRceHourlyPln(fromISO, toISO) as Promise<Array<{ timestamp: string; pln_per_kwh: number }>>
    } catch {
      // jeśli nie masz jeszcze providera RCE – zwróć puste
      return [] as Array<{ timestamp: string; pln_per_kwh: number }>
    }
  })()

  const [foxRes, rceRes] = await Promise.allSettled([
    withTimeout(foxPromise, FOX_TIMEOUT_MS, 'FoxESS'),
    withTimeout(rcePromise, RCE_TIMEOUT_MS, 'RCE'),
  ])

  let fox: Array<{ timestamp: string; exported_kwh: number }> = []
  let rce: Array<{ timestamp: string; pln_per_kwh: number }> = []

  if (foxRes.status === 'fulfilled') {
    fox = foxRes.value || []
  } else {
    errors.foxess = foxRes.reason?.message || String(foxRes.reason)
  }
  if (rceRes.status === 'fulfilled') {
    rce = rceRes.value || []
  } else {
    errors.rce = rceRes.reason?.message || String(rceRes.reason)
  }

  // merge
  const map = new Map<string, HourRow>()
  for (const p of fox) map.set(p.timestamp, { timestamp: p.timestamp, exported_kwh: Number(p.exported_kwh) || 0 })
  for (const p of rce) {
    const row = map.get(p.timestamp) || { timestamp: p.timestamp, exported_kwh: 0 }
    row.rce_pln_per_kwh = Number(p.pln_per_kwh) || 0
    row.revenue_pln = Number(((row.exported_kwh || 0) * (row.rce_pln_per_kwh || 0)).toFixed(6))
    map.set(p.timestamp, row)
  }

  const hourly = Array.from(map.values()).sort((a,b) => a.timestamp.localeCompare(b.timestamp))
  const totals = hourly.reduce((acc, r) => {
    acc.exported_kwh += r.exported_kwh || 0
    acc.revenue_pln  += r.revenue_pln || 0
    return acc
  }, { exported_kwh: 0, revenue_pln: 0 })

  return new Response(JSON.stringify({
    ok: true,
    date: dateUsed,
    range: { fromISO, toISO },
    hourly,
    totals: {
      exported_kwh: Number(totals.exported_kwh.toFixed(6)),
      revenue_pln: Number(totals.revenue_pln.toFixed(6)),
    },
    errors: Object.keys(errors).length ? errors : undefined
  }, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  })
}
