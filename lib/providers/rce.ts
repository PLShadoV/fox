// lib/providers/rce.ts
/**
 * RCE (PLN/MWh) z PSE v2 → Map<ISO_UTC_hour, PLN/kWh>
 * Odporny na warianty pól czasu i filtry:
 *  - business_date / doba
 *  - fallback: zakres po udtczas (czas lokalny PL)
 */

const PSE_BASE = process.env.PSE_API_BASE || 'https://api.raporty.pse.pl'
const TZ = 'Europe/Warsaw'

type RceRow = {
  rce_pln?: number
  business_date?: string
  doba?: string
  // czasy:
  period_utc?: string       // 2025-08-17T12:00:00Z
  dtime_utc?: string        // 2025-08-17T12:00:00Z
  udtczas_oreb?: string     // 'YYYY-MM-DD HH:mm' (PL)
  udtczas?: string          // 'YYYY-MM-DD HH:mm' (PL)
}

/* ---------- pomocnicze: czas PL → UTC ---------- */
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
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const off = offsetMinFor(y, m1, d, h, 0)
  return new Date(Date.UTC(y, m1, d, h, 0, 0, 0) - off * 60_000).toISOString()
}
function ymdWarsaw(dateISO: string) {
  const d = new Date(dateISO)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const Y = parts.find(p => p.type === 'year')!.value
  const M = parts.find(p => p.type === 'month')!.value
  const D = parts.find(p => p.type === 'day')!.value
  return `${Y}-${M}-${D}`
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/* ---------- pobranie z API z danym $filter ---------- */
async function fetchRceWithFilter(ymd: string, filter: string): Promise<RceRow[]> {
  const url = new URL('/api/rce-pln', PSE_BASE)
  url.searchParams.set('$select', [
    'rce_pln',
    'business_date','doba',
    'period_utc','dtime_utc',
    'udtczas_oreb','udtczas'
  ].join(','))
  url.searchParams.set('$filter', filter)
  url.searchParams.set('$orderby', 'period_utc asc,dtime_utc asc,udtczas asc,udtczas_oreb asc')
  url.searchParams.set('$top', '200') // zapas na 24–48 rekordów

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
  const ct = res.headers.get('content-type') || ''
  const txt = await res.text()
  if (!res.ok) throw new Error(`RCE HTTP ${res.status} — ${txt.slice(0,200)}`)
  if (!ct.includes('application/json')) throw new Error(`RCE zwróciło ${ct}. Fragment: ${txt.slice(0,120)}`)
  const json = JSON.parse(txt)
  const rows: RceRow[] = Array.isArray(json?.value) ? json.value
                     : Array.isArray(json) ? json : []
  return rows
}

/* ---------- jedna doba: próby 3 filtrów ---------- */
export type RceFetchDebug = {
  day: string
  tried: Array<{ filter: string; count: number }>
}

async function fetchRceDayRobust(ymd: string): Promise<{ rows: RceRow[], dbg: RceFetchDebug }> {
  const tried: RceFetchDebug['tried'] = []

  // 1) business_date
  const f1 = `(business_date eq '${ymd}')`
  let rows = await fetchRceWithFilter(ymd, f1).catch(() => [] as RceRow[])
  tried.push({ filter: f1, count: rows.length })
  if (rows.length) return { rows, dbg: { day: ymd, tried } }

  // 2) doba (to samo znaczenie, inna nazwa pola)
  const f2 = `(doba eq '${ymd}')`
  rows = await fetchRceWithFilter(ymd, f2).catch(() => [] as RceRow[])
  tried.push({ filter: f2, count: rows.length })
  if (rows.length) return { rows, dbg: { day: ymd, tried } }

  // 3) zakres po lokalnym czasie udtczas
  const start = `${ymd} 00:00`
  const end   = `${ymd} 23:59`
  const f3 = `(udtczas ge '${start}' and udtczas le '${end}')`
  rows = await fetchRceWithFilter(ymd, f3).catch(() => [] as RceRow[])
  tried.push({ filter: f3, count: rows.length })
  return { rows, dbg: { day: ymd, tried } }
}

/** Mapuje wiersz do klucza ISO UTC i ceny w PLN/kWh. */
function mapRowToPoint(r: RceRow): [string, number] | null {
  if (typeof r.rce_pln !== 'number') return null
  const priceKwh = r.rce_pln / 1000 // PLN/MWh → PLN/kWh

  // Priorytet: UTC → PL
  if (r.period_utc)  return [new Date(r.period_utc).toISOString(), priceKwh]
  if (r.dtime_utc)   return [new Date(r.dtime_utc).toISOString(),  priceKwh]

  // PL → UTC
  const asPL = (s?: string) => {
    if (!s) return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/)
    if (!m) return null
    const Y = +m[1], M = +m[2], D = +m[3], H = +m[4]
    return isoForWarsawHour(Y, M - 1, D, H)
  }
  const fromUdt = asPL(r.udtczas);      if (fromUdt) return [fromUdt, priceKwh]
  const fromOre = asPL(r.udtczas_oreb); if (fromOre) return [fromOre, priceKwh]

  return null
}

/**
 * Główna funkcja: Map<ISO_UTC_godzina, PLN/kWh>. Zwracamy wszystkie dni w zakresie.
 */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  if (!fromISO || !toISO) return new Map()

  const ymdFrom = ymdWarsaw(fromISO)
  const ymdTo   = ymdWarsaw(toISO)

  const days: string[] = []
  let cursor = new Date(`${ymdFrom}T00:00:00.000Z`).toISOString()
  while (true) {
    const y = ymdWarsaw(cursor)
    days.push(y)
    if (y === ymdTo) break
    cursor = addDaysISO(cursor, 1)
  }

  const out = new Map<string, number>()
  for (const ymd of days) {
    const { rows } = await fetchRceDayRobust(ymd)
    for (const r of rows) {
      const p = mapRowToPoint(r)
      if (!p) continue
      out.set(p[0], p[1]) // ISO UTC → PLN/kWh (może być ujemna)
    }
  }
  return out
}

/** (opcjonalnie) debug do wglądu, które filtry zadziałały */
export async function debugRceDay(ymd: string) {
  return await fetchRceDayRobust(ymd)
}
