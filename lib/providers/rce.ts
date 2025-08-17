// lib/providers/rce.ts
/**
 * Pobieranie RCE (PLN/kWh) z PSE — stabilnie i „dzień po dniu”.
 * V2: https://api.raporty.pse.pl/api/rce-pln?$filter=business_date eq 'YYYY-MM-DD'
 * Fallback V1 (do końca 2025): https://v1.api.raporty.pse.pl/api/rce-pln?$filter=doba eq 'YYYY-MM-DD'
 *
 * Zwraca mapę: ISO UTC (pełna godzina) -> cena PLN/kWh (może być < 0).
 */

const TZ = 'Europe/Warsaw'

type V2Row = {
  rce_pln?: number | string | null
  period_utc?: string | null
  dtime_utc?: string | null
  business_date?: string
}

type V1Row = {
  rce_pln?: number | string | null
  udtczas_oreb?: string | null // lokalna godzina OREB
  udtczas?: string | null      // lokalny timestamp
  doba?: string | null         // YYYY-MM-DD
}

/* ------------ pomocnicze: daty w strefie PL ------------- */

function ymdPL(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const Y = parts.find(p => p.type === 'year')!.value
  const M = parts.find(p => p.type === 'month')!.value
  const D = parts.find(p => p.type === 'day')!.value
  return `${Y}-${M}-${D}`
}

function midnightPLUTC(d: Date) {
  // robi „północ czasu PL” jako instant UTC
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const Y = +parts.find(p => p.type === 'year')!.value
  const M = +parts.find(p => p.type === 'month')!.value
  const D = +parts.find(p => p.type === 'day')!.value
  // wyznacz offset PL w minutach dla tej daty
  const probe = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0))
  const sh = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).format(probe)
  const m = sh.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  const sign = m?.[1]?.startsWith('-') ? -1 : 1
  const hh = m ? Math.abs(parseInt(m[1], 10)) : 1
  const mm = m?.[2] ? parseInt(m[2], 10) : 0
  const offMin = sign * (hh * 60 + mm)
  const utcMs = Date.UTC(Y, M - 1, D, 0, 0, 0, 0) - offMin * 60_000
  return new Date(utcMs)
}

function enumerateDaysPL(fromISO: string, toISO: string) {
  const start = midnightPLUTC(new Date(fromISO))
  const end = midnightPLUTC(new Date(toISO))
  const out: string[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600_000) {
    out.push(ymdPL(new Date(t)))
  }
  return Array.from(new Set(out))
}

function clampHourUTC(d: Date) {
  const c = new Date(d); c.setUTCMinutes(0, 0, 0); return c
}

function parsePrice(x: unknown) {
  if (typeof x === 'number') return x
  if (typeof x === 'string') {
    // dopuszczamy „1,23” lub „1.23”
    const s = x.replace(',', '.').trim()
    const n = Number(s)
    return isFinite(n) ? n : 0
  }
  return 0
}

/* --------------------- V2: api.raporty.pse.pl --------------------- */

async function fetchDayV2(dayYmd: string) {
  const base = process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl'
  const url = new URL('/api/rce-pln', base)
  url.searchParams.set('$filter', `business_date eq '${dayYmd}'`)
  url.searchParams.set('$orderby', 'period_utc asc')
  url.searchParams.set('$top', '500')

  const res = await fetch(url.toString(), {
    headers: { 'accept': 'application/json' },
    // cache od strony Vercel; nie spamujemy API
    next: { revalidate: 600 },
  })
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`RCE V2 HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) throw new Error(`RCE V2 content-type=${ct}`)

  let json: any
  try { json = JSON.parse(text) } catch { throw new Error('RCE V2 JSON parse error') }
  const arr: V2Row[] = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])

  const map = new Map<string, number>()
  for (const row of arr) {
    const iso = (row.period_utc || row.dtime_utc || '').toString()
    if (!iso) continue
    const hourIso = clampHourUTC(new Date(iso)).toISOString()
    const price = parsePrice(row.rce_pln)
    map.set(hourIso, price)
  }
  return { map, count: map.size, rawCount: arr.length }
}

/* --------------------- V1 fallback: v1.api.raporty.pse.pl --------------------- */

async function fetchDayV1(dayYmd: string) {
  const base = 'https://v1.api.raporty.pse.pl'
  const url = new URL('/api/rce-pln', base)
  url.searchParams.set('$filter', `doba eq '${dayYmd}'`)
  url.searchParams.set('$top', '500')

  const res = await fetch(url.toString(), {
    headers: { 'accept': 'application/json' },
    next: { revalidate: 600 },
  })
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`RCE V1 HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) throw new Error(`RCE V1 content-type=${ct}`)

  let json: any
  try { json = JSON.parse(text) } catch { throw new Error('RCE V1 JSON parse error') }
  const arr: V1Row[] = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])

  const map = new Map<string, number>()
  for (const row of arr) {
    // V1 zwykle zwraca lokalne „udtczas_oreb” — konwertujemy na UTC po zparsowaniu
    const local = row.udtczas_oreb || row.udtczas || ''
    if (!local) continue
    // zakładamy format „YYYY-MM-DD HH:mm” w strefie PL
    const m = local.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
    if (!m) continue
    const [_, dStr, HH, MM] = m
    const [Y, M, D] = dStr.split('-').map(n => +n)
    const probe = new Date(Date.UTC(Y, (M - 1), D, +HH, +MM, 0, 0))
    // zamiana „lokalna”→UTC: jak w midnightPLUTC obliczamy offset
    const sh = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).format(probe)
    const m2 = sh.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
    const sign = m2?.[1]?.startsWith('-') ? -1 : 1
    const hh = m2 ? Math.abs(parseInt(m2[1], 10)) : 1
    const mm = m2?.[2] ? parseInt(m2[2], 10) : 0
    const offMin = sign * (hh * 60 + mm)
    const utcMs = Date.UTC(Y, (M - 1), D, +HH, +MM, 0, 0) - offMin * 60_000
    const hourIso = clampHourUTC(new Date(utcMs)).toISOString()

    const price = parsePrice(row.rce_pln)
    map.set(hourIso, price)
  }
  return { map, count: map.size, rawCount: arr.length }
}

/* --------------------------- PUBLIC API --------------------------- */

/**
 * Zwraca mapę godzin (UTC ISO) -> cena RCE (PLN/kWh) dla zakresu [from..to].
 * Robimy wywołania „dzień po dniu”, co stabilnie działa w V2 PSE.
 */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const days = enumerateDaysPL(fromISO, toISO)
  const out = new Map<string, number>()

  for (const day of days) {
    // spróbuj V2
    try {
      const v2 = await fetchDayV2(day)
      if (v2.count > 0) {
        for (const [k, v] of v2.map) out.set(k, v)
        continue
      }
    } catch (_) {
      // zignoruj, spróbuj V1
    }
    // fallback V1
    try {
      const v1 = await fetchDayV1(day)
      for (const [k, v] of v1.map) out.set(k, v)
    } catch (_) {
      // nic — brak danych dla tego dnia
    }
  }

  return out
}
