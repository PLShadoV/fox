// lib/providers/rce.ts
/**
 * Pobieranie RCE PLN z API PSE z fallbackami:
 * 1) v2 z filtrem po dacie (doba / business_date / udtczas / period_utc),
 * 2) v1 z tymi samymi wariantami,
 * 3) "bulk": pobranie ~ostatnich 2000 rekordów i wycięcie do potrzebnego zakresu.
 *
 * Zwraca Map<ISO_UTC_godziny, cenaPLN_MWh>.
 */
const TZ = 'Europe/Warsaw'

type RceRow = {
  period_utc?: string
  rce_pln?: number
  udtczas_oreb?: string
  doba?: string
  business_date?: string
}

/* ---------------------- POMOCNICZE: dni w PL ---------------------- */

function plDateString(dt: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(dt)
  const get = (t: string) => p.find(x => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}` // YYYY-MM-DD
}

function enumerateDaysPL(fromISO: string, toISO: string): string[] {
  const start = new Date(fromISO)
  const end = new Date(toISO)
  const days = new Set<string>()
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600_000) {
    days.add(plDateString(new Date(t)))
  }
  return [...days]
}

/* ---------------------- FETCH (różne warianty) ---------------------- */

const COMMON_HEADERS: Record<string, string> = {
  'accept': 'application/json',
  'OData-Version': '4.0',
  'OData-MaxVersion': '4.0',
  // user-agent jak “normalna” przeglądarka – bywa, że serwer jest czuły
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36'
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: COMMON_HEADERS, cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false as const, http: res.status, data: null as any }
  }
  try {
    const data = JSON.parse(text)
    return { ok: true as const, http: res.status, data }
  } catch {
    return { ok: false as const, http: res.status, data: null }
  }
}

// Zwraca tablicę rekordów (value -> OData)
function extractRows(x: any): RceRow[] {
  if (!x) return []
  if (Array.isArray(x)) return x as RceRow[]
  if (Array.isArray(x.value)) return x.value as RceRow[]
  return []
}

/* ---------------------- GŁÓWNE: pobieranie dnia ---------------------- */

async function fetchRceDay(day: string): Promise<{ rows: RceRow[]; tried: Array<{api: string; url: string; ok: boolean; http: number; count: number}> }> {
  const tried: Array<{api: string; url: string; ok: boolean; http: number; count: number}> = []

  // kolejność prób – najpierw v2, potem v1, na końcu “bulk”
  const variants: Array<{ api: string; url: string }> = [
    // v2 – “czysta” doba
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=doba eq '${day}'` },
    // v2 – business_date (bywa używane w przykładach)
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=business_date eq '${day}'` },
    // v2 – po znaczniku czasu (tekstowo)
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=udtczas ge '${day} 00:00' and udtczas le '${day} 23:59'` },
    // v2 – po period_utc (datetimeoffset)
    { api: 'v2', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc lt datetimeoffset'${day}T24:00:00Z'` },

    // v1 – analogiczne filtry
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=doba eq '${day}'` },
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=udtczas_oreb ge '${day} 00:00' and udtczas_oreb le '${day} 23:59'` },
    { api: 'v1', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc asc&$top=500&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc lt datetimeoffset'${day}T24:00:00Z'` },
  ]

  for (const v of variants) {
    const r = await fetchJson(v.url)
    const rows = r.ok ? extractRows(r.data) : []
    tried.push({ api: v.api, url: v.url, ok: r.ok, http: r.http, count: rows.length })
    if (r.ok && rows.length > 0) {
      return { rows, tried }
    }
  }

  // BULK – ostatnie rekordy (oba hosty), potem filtr klientem
  const bulkCandidates = [
    { api: 'bulk', url: `https://api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000` },
    { api: 'bulk', url: `https://v1.api.raporty.pse.pl/api/rce-pln?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000` },
  ]
  for (const v of bulkCandidates) {
    const r = await fetchJson(v.url)
    const all = r.ok ? extractRows(r.data) : []
    const rows = all.filter(x => typeof x.period_utc === 'string' && x.period_utc.startsWith(day))
    tried.push({ api: v.api, url: v.url, ok: r.ok, http: r.http, count: rows.length })
    if (r.ok && rows.length > 0) {
      return { rows, tried }
    }
  }

  return { rows: [], tried }
}

/* --------------- API PUBLICZNE: zakres → Map<ISO, cena> --------------- */

export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const days = enumerateDaysPL(fromISO, toISO)
  const out = new Map<string, number>()

  for (const day of days) {
    const { rows } = await fetchRceDay(day)
    for (const r of rows) {
      const iso = r.period_utc ? new Date(r.period_utc).toISOString() : ''
      if (!iso) continue
      const price = Number(r.rce_pln ?? 0)
      out.set(iso, price) // uwaga: może być < 0 – tak właśnie chcemy (UI pokaże, revenue liczone z max(price,0))
    }
  }

  return out
}
