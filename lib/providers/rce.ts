// lib/providers/rce.ts
/**
 * RCE (PLN/MWh) → Map<ISO_UTC_hour, PLN/kWh>
 * Odporne na zmiany pól czasu i filtry OData + fallback na v1 API.
 */

const PSE_BASE_V2 = process.env.PSE_API_BASE || 'https://api.raporty.pse.pl'
const PSE_BASE_V1 = 'https://v1.api.raporty.pse.pl'
const TZ = 'Europe/Warsaw'

type RceRow = {
  rce_pln?: number
  business_date?: string
  doba?: string
  period_utc?: string
  dtime_utc?: string
  udtczas?: string
  udtczas_oreb?: string
}

type Tried = { filter: string; url: string; count: number }
export type RceFetchDebug = {
  day: string
  bases: Array<{ base: string; tried: Tried[] }>
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

/* ---------- budowa URL z ręcznym kodowaniem OData ---------- */
function buildRceUrl(base: string, filter: string) {
  const qs = [
    // pobieramy maks info i prosty JSON
    `$select=${encodeURIComponent([
      'rce_pln',
      'business_date','doba',
      'period_utc','dtime_utc',
      'udtczas','udtczas_oreb'
    ].join(','))}`,
    `$filter=${encodeURIComponent(filter)}`,
    `$orderby=${encodeURIComponent('period_utc asc,dtime_utc asc,udtczas asc,udtczas_oreb asc')}`,
    `$top=200`,
    `$count=true`,
    `$format=application/json`
  ].join('&')
  return `${base.replace(/\/+$/,'')}/api/rce-pln?${qs}`
}

async function fetchRceWithFilter(base: string, filter: string): Promise<{ rows: RceRow[]; tried: Tried }> {
  const url = buildRceUrl(base, filter)
  const res = await fetch(url, { headers: { 'accept': 'application/json' }, next: { revalidate: 1800 } })
  const txt = await res.text()
  let rows: any = []
  try {
    const json = JSON.parse(txt)
    rows = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])
  } catch {
    rows = []
  }
  return { rows, tried: { filter, url, count: Array.isArray(rows) ? rows.length : 0 } }
}

/* ---------- jedna doba: wiele filtrów + zwrot debug ---------- */
async function fetchRceDayFromBase(base: string, ymd: string) {
  const filters: string[] = [
    // 1) business_date jako date (bez cudzysłowów) i jako string
    `(business_date eq ${ymd})`,
    `(business_date eq '${ymd}')`,
    // 2) doba (string)
    `(doba eq '${ymd}')`,
    // 3) zakresy czasowe po UTC
    `(period_utc ge ${ymd}T00:00:00Z and period_utc lt ${ymd}T00:00:00Z add 1.00:00:00)`,
    `(dtime_utc ge ${ymd}T00:00:00Z and dtime_utc lt ${ymd}T00:00:00Z add 1.00:00:00)`,
    // 4) zakresy po lokalnym PL
    `(udtczas ge '${ymd} 00:00' and udtczas le '${ymd} 23:59')`,
    `(udtczas_oreb ge '${ymd} 00:00' and udtczas_oreb le '${ymd} 23:59')`,
  ]

  const tried: Tried[] = []
  for (const f of filters) {
    const { rows, tried: t } = await fetchRceWithFilter(base, f)
    tried.push(t)
    if (Array.isArray(rows) && rows.length) {
      return { rows: rows as RceRow[], tried }
    }
  }
  return { rows: [] as RceRow[], tried }
}

/** (eksport) – debug z obiema bazami */
export async function debugRceDay(dayYmd: string): Promise<RceFetchDebug> {
  const out: RceFetchDebug = { day: dayYmd, bases: [] }
  // v2
  const v2 = await fetchRceDayFromBase(PSE_BASE_V2, dayYmd)
  out.bases.push({ base: PSE_BASE_V2, tried: v2.tried })
  // v1
  const v1 = await fetchRceDayFromBase(PSE_BASE_V1, dayYmd)
  out.bases.push({ base: PSE_BASE_V1, tried: v1.tried })
  return out
}

/** mapowanie wiersza na [ISO_UTC_godzina, PLN/kWh] */
function mapRowToPoint(r: RceRow): [string, number] | null {
  if (typeof r.rce_pln !== 'number') return null
  const priceKwh = r.rce_pln / 1000 // PLN/MWh → PLN/kWh

  // Priorytet: gotowe UTC
  if (r.period_utc) return [new Date(r.period_utc).toISOString(), priceKwh]
  if (r.dtime_utc)  return [new Date(r.dtime_utc).toISOString(),  priceKwh]

  // PL → UTC
  const asPL = (s?: string) => {
    if (!s) return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/)
    if (!m) return null
    const Y = +m[1], M = +m[2], D = +m[3], H = +m[4]
    return isoForWarsawHour(Y, M - 1, D, H)
  }
  const u1 = asPL(r.udtczas);      if (u1) return [u1, priceKwh]
  const u2 = asPL(r.udtczas_oreb); if (u2) return [u2, priceKwh]

  return null
}

/** główna: Map<ISO_UTC_hour, PLN/kWh>; próba v2 → fallback v1 */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  if (!fromISO || !toISO) return new Map()

  // zbiór dni PL w zakresie
  const days: string[] = []
  let cur = new Date(fromISO)
  const end = new Date(toISO)
  while (true) {
    const ymd = ymdWarsaw(cur.toISOString())
    if (!days.includes(ymd)) days.push(ymd)
    if (ymd === ymdWarsaw(end.toISOString())) break
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  // najpierw v2
  let collected: RceRow[] = []
  for (const d of days) {
    const v2 = await fetchRceDayFromBase(PSE_BASE_V2, d)
    if (v2.rows.length) collected.push(...v2.rows)
  }
  // fallback na v1 jeśli dalej nic
  if (!collected.length) {
    for (const d of days) {
      const v1 = await fetchRceDayFromBase(PSE_BASE_V1, d)
      if (v1.rows.length) collected.push(...v1.rows)
    }
  }

  const out = new Map<string, number>()
  for (const r of collected) {
    const p = mapRowToPoint(r)
    if (!p) continue
    out.set(p[0], p[1])
  }
  return out
}
