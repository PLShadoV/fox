// lib/providers/rce.ts
/**
 * RCE (PLN/MWh) z PSE v2.
 * Pobieramy: period_utc (pełna godzina w UTC), rce_pln, business_date.
 * Zwracamy Map<ISO_UTC_godzina, PLN/kWh> (cena może być ujemna).
 */
const PSE_BASE = process.env.PSE_API_BASE || 'https://api.raporty.pse.pl'

type RceRow = {
  period_utc?: string
  rce_pln?: number
  business_date?: string
}

function ymdWarsaw(dateISO: string) {
  const d = new Date(dateISO)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

async function fetchRceDay(ymd: string): Promise<RceRow[]> {
  const url = new URL('/api/rce-pln', PSE_BASE)
  url.searchParams.set('$select', 'period_utc,rce_pln,business_date')
  url.searchParams.set('$filter', `business_date eq '${ymd}'`)
  url.searchParams.set('$orderby', 'period_utc asc')

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

/** Zwraca mapę: ISO_UTC_godzina -> cena PLN/kWh (może być ujemna). */
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
        if (!r.period_utc || typeof r.rce_pln !== 'number') continue
        const key = new Date(r.period_utc).toISOString()     // klucz = godzina UTC
        const priceKwh = r.rce_pln / 1000                    // PLN/MWh -> PLN/kWh
        out.set(key, priceKwh)
      }
    } catch { /* brak danych dla doby = ceny zostaną 0 */ }
  }
  return out
}
