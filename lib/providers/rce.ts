// lib/providers/rce.ts
// Pobieranie RCE PLN/kWh z PSE (v2 -> v1 -> fallback $top) i zwrot jako Map<ISO_UTC_godzina, cena>

const V2 = 'https://api.raporty.pse.pl/api/rce-pln'
const V1 = 'https://v1.api.raporty.pse.pl/api/rce-pln'

type RceRow = { period_utc?: string; udtczas?: string; udtczas_oreb?: string; rce_pln?: number }
type FetchResult = { ok: boolean; url: string; http?: number; rows: RceRow[] }

function clampHourISO(d: Date) {
  const c = new Date(d); c.setUTCMinutes(0, 0, 0); return c.toISOString()
}

function toIsoHourLoose(x: any): string | null {
  if (!x) return null
  // obsługa "2025-08-17T10:00:00Z", "2025-08-17 10:00", itp.
  const s = String(x).replace(' ', 'T')
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + ':00Z')
  if (isNaN(d.getTime())) {
    const d2 = new Date(x)
    if (isNaN(d2.getTime())) return null
    return clampHourISO(d2)
  }
  return clampHourISO(d)
}

async function fetchJson(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 300 },
    })
    const http = res.status
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* nie JSON */ }

    // OData zwykle zwraca { value: [...] }
    const rows: RceRow[] = Array.isArray(json?.value) ? json.value as RceRow[] : (Array.isArray(json) ? json as RceRow[] : [])
    return { ok: res.ok && Array.isArray(rows), url, http, rows }
  } catch (e) {
    return { ok: false, url, http: undefined, rows: [] }
  }
}

function buildV2DayUrls(day: string): string[] {
  const enc = encodeURIComponent
  const sel = '$select=period_utc,rce_pln'
  const ord = '$orderby=period_utc asc'
  const top = '$top=500'
  const d0 = `${day} 00:00`, d1 = `${day} 23:59`
  return [
    // 1) business_date (jeśli to pole ma typ date – część instalacji działa z tym)
    `${V2}?${sel}&${ord}&${top}&$filter=business_date eq '${day}'`,
    // 2) doba (spotykane w przykładach)
    `${V2}?${sel}&${ord}&${top}&$filter=doba eq '${day}'`,
    // 3) udtczas jako lokalny czas (tak używa wiele integracji HA)
    `${V2}?${sel}&${ord}&${top}&$filter=udtczas ge '${d0}' and udtczas le '${d1}'`,
    // 4) zakres po UTC z typem datetimeoffset
    `${V2}?${sel}&${ord}&${top}&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc le datetimeoffset'${day}T23:59:59Z'`,
  ]
}

function buildV1DayUrls(day: string): string[] {
  const sel = '$select=period_utc,rce_pln'
  const ord = '$orderby=period_utc asc'
  const top = '$top=500'
  const d0 = `${day} 00:00`, d1 = `${day} 23:59`
  return [
    `${V1}?${sel}&${ord}&${top}&$filter=doba eq '${day}'`,
    `${V1}?${sel}&${ord}&${top}&$filter=udtczas_oreb ge '${d0}' and udtczas_oreb le '${d1}'`,
    `${V1}?${sel}&${ord}&${top}&$filter=period_utc ge datetimeoffset'${day}T00:00:00Z' and period_utc le datetimeoffset'${day}T23:59:59Z'`,
  ]
}

/** Fallback bez filtra – bierzemy ostatnie ~2000 rekordów i tniemy lokalnie */
function buildBulkUrls(): string[] {
  return [
    `${V2}?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000`,
    `${V1}?$select=period_utc,rce_pln&$orderby=period_utc desc&$top=2000`,
  ]
}

function rowsToMap(rows: RceRow[], fromISO: string, toISO: string): Map<string, number> {
  const fromT = new Date(fromISO).getTime()
  const toT = new Date(toISO).getTime()
  const map = new Map<string, number>()
  for (const r of rows) {
    const iso = toIsoHourLoose(r.period_utc || r.udtczas || r.udtczas_oreb)
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (t < fromT || t > toT) continue
    const price = Number(r.rce_pln ?? 0)
    if (Number.isFinite(price)) map.set(iso, price)
  }
  return map
}

/** Pobierz ceny RCE dla pojedynczego dnia (YYYY-MM-DD); zwróć surowe rekordy */
async function fetchDayRaw(day: string): Promise<{ rows: RceRow[]; tried: Array<{ api: 'v2' | 'v1' | 'bulk', url: string, ok: boolean, http?: number, count: number }> }> {
  const tried: Array<{ api: 'v2' | 'v1' | 'bulk', url: string, ok: boolean, http?: number, count: number }> = []

  // v2
  for (const url of buildV2DayUrls(day)) {
    const r = await fetchJson(url)
    tried.push({ api: 'v2', url: r.url, ok: r.ok, http: r.http, count: r.rows.length })
    if (r.ok && r.rows.length) return { rows: r.rows, tried }
  }
  // v1
  for (const url of buildV1DayUrls(day)) {
    const r = await fetchJson(url)
    tried.push({ api: 'v1', url: r.url, ok: r.ok, http: r.http, count: r.rows.length })
    if (r.ok && r.rows.length) return { rows: r.rows, tried }
  }
  // bulk (bez filtra – bierzemy większą paczkę)
  for (const url of buildBulkUrls()) {
    const r = await fetchJson(url)
    tried.push({ api: 'bulk', url: r.url, ok: r.ok, http: r.http, count: r.rows.length })
    if (r.ok && r.rows.length) {
      // uwaga: dalej przefiltrujemy po zakresie w mapowaniu
      return { rows: r.rows, tried }
    }
  }
  return { rows: [], tried }
}

/** Publiczne: zwróć Map<ISO_UTC_godzina, cena PLN/kWh> dla zadanego zakresu [fromISO..toISO] */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  // Dni w PL nie są tu potrzebne – porównujemy po UTC (period_utc)
  // Zrobimy jednak per-dzień, żeby nie pobierać za dużo
  const start = new Date(fromISO)
  const end = new Date(toISO)
  const out = new Map<string, number>()

  // policz ile dób
  const days: string[] = []
  const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  for (let t = dt; t.getTime() <= endDay.getTime(); t.setUTCDate(t.getUTCDate() + 1)) {
    const y = t.getUTCFullYear()
    const m = String(t.getUTCMonth() + 1).padStart(2, '0')
    const d = String(t.getUTCDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
  }

  for (const day of days) {
    const { rows } = await fetchDayRaw(day)
    if (!rows.length) continue
    const map = rowsToMap(rows, fromISO, toISO)
    for (const [k, v] of map) out.set(k, v)
  }
  return out
}

/** Debug-helper (używany w /api/rce/debug) */
export const __rce_internal = { buildV2DayUrls, buildV1DayUrls, buildBulkUrls, fetchDayRaw, rowsToMap, V1, V2 }
