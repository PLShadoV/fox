// app/api/data/route.ts
import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'
import { fetchRcePlnMap } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = { ts: string; kwh: number; price: number; revenue: number }
const TZ = 'Europe/Warsaw'

/* ----------------------- CZAS: PL -> UTC (z DST) ----------------------- */
function offsetMinFor(y: number, m1: number, d: number, h = 0, mi = 0) {
  const probe = new Date(Date.UTC(y, m1, d, h, mi, 0, 0))
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).format(probe)
  const m = s.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!m) return [3,4,5,6,7,8,9].includes(m1) ? 120 : 60
  const sign = m[1].startsWith('-') ? -1 : 1
  const hh = Math.abs(parseInt(m[1], 10))
  const mm = m[2] ? parseInt(m[2], 10) : 0
  return sign * (hh * 60 + mm)
}
function isoPL(y: number, m1: number, d: number, H = 0, M = 0, S = 0, ms = 0) {
  const off = offsetMinFor(y, m1, d, H, M)
  const utcMs = Date.UTC(y, m1, d, H, M, S, ms) - off * 60_000
  return new Date(utcMs).toISOString()
}
function dayBoundsPL(dt: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(dt)
  const get = (t: string) => Number(p.find(x => x.type === t)!.value)
  const y = get('year'), m = get('month'), d = get('day')
  return {
    start: isoPL(y, m - 1, d, 0, 0, 0, 0),
    end:   isoPL(y, m - 1, d, 23, 59, 59, 999),
  }
}
function parseFlexible(input: string | null | undefined, which: 'start'|'end'): string {
  if (!input) return ''
  let s = decodeURIComponent(String(input)).trim()
  { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString() }
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (m) {
    const D = +m[1], M = +m[2], Y = +m[3]
    const H = m[4] ? +m[4] : (which === 'start' ? 0 : 23)
    const Min = m[5] ? +m[5] : (which === 'start' ? 0 : 59)
    return isoPL(Y, M - 1, D, H, Min, which === 'start' ? 0 : 59, which === 'start' ? 0 : 999)
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
  if (m) {
    const Y = +m[1], M = +m[2], D = +m[3]
    const H = m[4] ? +m[4] : (which === 'start' ? 0 : 23)
    const Min = m[5] ? +m[5] : (which === 'start' ? 0 : 59)
    return isoPL(Y, M - 1, D, H, Min, which === 'start' ? 0 : 59, which === 'start' ? 0 : 999)
  }
  return ''
}
function enumerateMidnightsPL(fromISO: string, toISO: string) {
  const start = new Date(fromISO)
  const end = new Date(toISO)
  const s = dayBoundsPL(start).start
  const e = dayBoundsPL(end).start
  const out: string[] = []
  for (let t = new Date(s).getTime(); t <= new Date(e).getTime(); t += 24 * 3600_000) {
    out.push(new Date(t).toISOString())
  }
  return out
}
function clampToHourUTC(d: Date) {
  const c = new Date(d); c.setUTCMinutes(0,0,0); return c
}

/* --------------------------- CACHE: 30 s --------------------------- */
type CacheEntry = { ts: number; rows: Row[]; stats?: any }
const DATA_TTL_MS = 30_000 // ⬅️ odświeżanie co 30 s
const g = globalThis as any
g.__data_cache ||= new Map<string, CacheEntry>()

/* ------------------------------- ROUTE ------------------------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const wantDebug = searchParams.get('debug') === '1'

    const now = new Date()
    const def = dayBoundsPL(now)
    const from = parseFlexible(searchParams.get('from'), 'start') || def.start
    const to   = parseFlexible(searchParams.get('to'),   'end')   || def.end

    const key = `${from}|${to}`
    const cached = g.__data_cache.get(key)
    if (cached && Date.now() - cached.ts < DATA_TTL_MS) {
      return new Response(JSON.stringify({ ok: true, rows: cached.rows, ...(wantDebug ? { stats: cached.stats } : {}) }, null, 2), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 's-maxage=30, stale-while-revalidate=15', // edge cache
        },
      })
    }

    // 1) ENERGIA z FoxESS (bucket: godziny UTC odpowiadające godzinom PL)
    const dayStarts = enumerateMidnightsPL(from, to)
    let energy: { ts: string; kwh: number }[] = []
    for (const dayStart of dayStarts) {
      const endOfDay = new Date(new Date(dayStart).getTime() + 24*3600_000 - 1).toISOString()
      const points = await fetchFoxEssHourlyExported(dayStart, endOfDay)
      energy.push(...points.map(p => ({ ts: p.timestamp, kwh: Number(p.exported_kwh || 0) })))
    }
    energy = energy.filter(e => {
      const t = new Date(e.ts).getTime()
      return t >= new Date(from).getTime() && t <= new Date(to).getTime()
    })
    const energyMap: Record<string, number> = {}
    for (const e of energy) {
      const k = clampToHourUTC(new Date(e.ts)).toISOString()
      energyMap[k] = (energyMap[k] || 0) + e.kwh
    }

    // 2) CENY RCE (mapa ISO_UTC -> PLN/kWh) – period_utc LUB udtczas_oreb
    const rceMap = await fetchRcePlnMap(from, to)

    // 3) siatka godzin od from..to (co 1h), merge + revenue=max(price,0)
    const start = clampToHourUTC(new Date(from))
    const end   = clampToHourUTC(new Date(to))
    const rows: Row[] = []
    for (let t = new Date(start); t <= end; t.setUTCHours(t.getUTCHours() + 1)) {
      const keyHour = t.toISOString()
      const kwh = Number(energyMap[keyHour] || 0)
      const price = Number(rceMap.get(keyHour) ?? 0)  // może być <0
      const eff   = price < 0 ? 0 : price
      rows.push({ ts: keyHour, kwh, price, revenue: +(kwh * eff).toFixed(6) })
    }

    const stats = wantDebug ? {
      hoursEnergy: rows.reduce((s, r) => s + (r.kwh > 0 ? 1 : 0), 0),
      rceHits: rows.reduce((s, r) => s + (r.price !== 0 ? 1 : 0), 0),
      firstHour: rows[0]?.ts,
      lastHour: rows[rows.length - 1]?.ts
    } : undefined

    g.__data_cache.set(key, { ts: Date.now(), rows, stats })
    return new Response(JSON.stringify({ ok: true, rows, ...(wantDebug ? { stats } : {}) }, null, 2), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=30, stale-while-revalidate=15',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'data error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
