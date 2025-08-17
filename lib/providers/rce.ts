// lib/providers/rce.ts
/**
 * RCE (PLN/MWh) z PSE v2.
 * Obsługujemy dwa warianty:
 *  - period_utc (pełna godzina w UTC)
 *  - udtczas_oreb (lokalna godzina PL) → konwersja do ISO UTC
 * Filtrowanie po business_date OR doba == 'YYYY-MM-DD'.
 * Zwracamy Map<ISO_UTC_godzina, PLN/kWh> (cena może być ujemna).
 */

const PSE_BASE = process.env.PSE_API_BASE || 'https://api.raporty.pse.pl'
const TZ = 'Europe/Warsaw'

type RceRow = {
  period_utc?: string
  udtczas_oreb?: string
  rce_pln?: number
  business_date?: string
  doba?: string
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

/* ---------- pobranie jednej doby ---------- */
async function fetchRceDay(ymd: string): Promise<RceRow[]> {
  const url = new URL('/api/rce-pln', PSE_BASE)
  url.searchParams.set('$select', 'period_utc,udtczas_oreb,rce_pln,business_date,doba')
  url.searchParams.set('$filter', `(business_date eq '${ymd}' or doba eq '${ymd}')`)
  url.searchParams.set('$orderby', 'period_utc asc,udtczas_oreb asc')

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

/** Mapuje dowolny wiersz RCE do klucza ISO UTC i ceny PLN/kWh. */
function mapRowToPoint(r: RceRow): [string, number] | null {
  if (typeof r.rce_pln !== 'number') return null
  const priceKwh = r.rce_pln / 1000 // PLN/MWh → PLN/kWh

  // 1) preferuj period_utc (UTC)
  if (r.period_utc) {
    const key = new Date(r.period_utc).toISOString()
    return [key, priceKwh]
  }

  // 2) fallback: udtczas_oreb = 'YYYY-MM-DD HH:mm...' w PL
  if (r.udtczas_oreb) {
    const m = r.udtczas_oreb.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/)
    if (m) {
      const Y = +m[1], M = +m[2], D = +m[3], H = +m[4]
      const key = isoForWarsawHour(Y, M - 1, D, H)
      return [key, priceKwh]
    }
  }

  return null
}

/**
 * Zwraca mapę: ISO_UTC_godzina -> cena PLN/kWh (może być ujemna).
 * fromISO/toISO – domykamy do dni PL i iterujemy po dobie handlowej.
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
    try {
      const rows = await fetchRceDay(ymd)
      for (const r of rows) {
        const p = mapRowToPoint(r)
        if (!p) continue
        out.set(p[0], p[1]) // ISO UTC → PLN/kWh
      }
    } catch { /* brak danych = zostają zera */ }
  }
  return out
}
