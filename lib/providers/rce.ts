// lib/providers/rce.ts
/**
 * RCE (PLN/MWh) → Map<ISO_UTC_hour, PLN/kWh>
 * Odporne na zmiany pól czasu i filtry OData; jeden strzał na zakres; fallback v1 i „ostatnie 500”.
 * Źródło pól: EndpointsMap.pdf (rce-pln: rce_pln, business_date/doba, period_utc/dtime_utc, udtczas/udtczas_oreb)
 */

const PSE_BASE_V2 = (process.env.PSE_API_BASE || 'https://api.raporty.pse.pl').replace(/\/+$/,'')
const PSE_BASE_V1 = 'https://v1.api.raporty.pse.pl'
const TZ = 'Europe/Warsaw'

export type RceRow = {
  rce_pln?: number
  business_date?: string
  doba?: string
  period_utc?: string
  dtime_utc?: string
  udtczas?: string
  udtczas_oreb?: string
}

type Tried = { base: string; filter: string; url: string; count: number }
export type RceFetchDebug = {
  range: { fromISO: string; toISO: string; toExclusiveISO: string }
  tried: Tried[]
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
function nextDayYmd(ymd: string) {
  const [Y,M,D] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(Y, M-1, D, 12))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0,10)
}

/* ---------- budowa URL z ręcznym kodowaniem OData ---------- */
function buildUrl(base: string, filter?: string, top = 0) {
  const params: string[] = []
  params.push(`$select=${encodeURIComponent([
    'rce_pln',
    'business_date','doba',
    'period_utc','dtime_utc',
    'udtczas','udtczas_oreb'
  ].join(','))}`)
  if (filter) params.push(`$filter=${encodeURIComponent(filter)}`)
  params.push(`$orderby=${encodeURIComponent('period_utc asc,dtime_utc asc,udtczas asc,udtczas_oreb asc')}`)
  if (top > 0) params.push(`$top=${top}`)
  params.push(`$count=true`)
  params.push(`$format=application/json`)
  return `${base}/api/rce-pln?${params.join('&')}`
}

async function fetchRows(base: string, filter?: string, top = 0) {
  const url = buildUrl(base, filter, top)
  const res = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 1800 } })
  const txt = await res.text()
  let rows: any = []
  try {
    const json = JSON.parse(txt)
    rows = Array.isArray(json?.value) ? json.value : (Array.isArray(json) ? json : [])
  } catch { rows = [] }
  return { url, rows: rows as RceRow[] }
}

/* ---------- mapowanie rekordu → [ISO_UTC_godzina, PLN/kWh] ---------- */
function mapRow(r: RceRow): [string, number] | null {
  if (typeof r.rce_pln !== 'number') return null
  const priceKwh = r.rce_pln / 1000 // PLN/MWh → PLN/kWh

  // gotowe UTC:
  if (r.period_utc) return [new Date(r.period_utc).toISOString(), priceKwh]
  if (r.dtime_utc)  return [new Date(r.dtime_utc).toISOString(),  priceKwh]

  // PL → UTC (hh z ciągu 'YYYY-MM-DD HH:mm')
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

/* ---------- GŁÓWNA: zakres → Map<ISO_UTC_hour, PLN/kWh> + debug ---------- */
export async function fetchRcePlnMap(fromISO: string, toISO: string, wantDebug = false): Promise<Map<string, number>> {
  const _dbg: Tried[] = []
  const out = new Map<string, number>()
  if (!fromISO || !toISO) return out

  // zbuduj końcówkę „exclusive”: < toExclusiveISO
  // (jeśli toISO to 23:59:59.999 PL→UTC, dodaj 1ms, mamy bezpieczne „< koniec”)
  const toExclusiveISO = new Date(new Date(toISO).getTime() + 1).toISOString()
  const dayFrom = ymdWarsaw(fromISO)
  const dayTo   = ymdWarsaw(toISO)
  const dayAfterTo = nextDayYmd(dayTo)

  // 1) v2: precyzyjnie po UTC (period_utc, potem dtime_utc)
  for (const [field, base] of [['period_utc', PSE_BASE_V2] as const, ['dtime_utc', PSE_BASE_V2] as const]) {
    const filter = `(${field} ge ${fromISO.replace('Z','')}Z and ${field} lt ${toExclusiveISO.replace('Z','')}Z)`
    const { url, rows } = await fetchRows(base, filter)
    _dbg.push({ base, filter, url, count: rows.length })
    if (rows.length) {
      for (const r of rows) { const p = mapRow(r); if (p) out.set(p[0], p[1]) }
      if (!wantDebug) return out
    }
  }

  // 2) v2: po dacie/PL (różne warianty)
  const v2DateFilters = [
    `(business_date eq ${dayFrom})`,
    `(business_date eq '${dayFrom}')`,
    `(doba eq '${dayFrom}')`,
    `(udtczas ge '${dayFrom} 00:00' and udtczas lt '${dayAfterTo} 00:00')`,
    `(udtczas_oreb ge '${dayFrom} 00:00' and udtczas_oreb lt '${dayAfterTo} 00:00')`,
  ]
  for (const filter of v2DateFilters) {
    const { url, rows } = await fetchRows(PSE_BASE_V2, filter)
    _dbg.push({ base: PSE_BASE_V2, filter, url, count: rows.length })
    if (rows.length) {
      for (const r of rows) { const p = mapRow(r); if (p) out.set(p[0], p[1]) }
      if (!wantDebug) return out
      break
    }
  }

  // 3) fallback v1 (ten sam zestaw filtrów co v2)
  const v1Filters = [
    `(${`period_utc ge ${fromISO.replace('Z','')}Z and period_utc lt ${toExclusiveISO.replace('Z','')}Z`})`,
    `(${`dtime_utc ge ${fromISO.replace('Z','')}Z and dtime_utc lt ${toExclusiveISO.replace('Z','')}Z`})`,
    `(business_date eq ${dayFrom})`,
    `(business_date eq '${dayFrom}')`,
    `(doba eq '${dayFrom}')`,
    `(udtczas ge '${dayFrom} 00:00' and udtczas lt '${dayAfterTo} 00:00')`,
    `(udtczas_oreb ge '${dayFrom} 00:00' and udtczas_oreb lt '${dayAfterTo} 00:00')`,
  ]
  for (const filter of v1Filters) {
    const { url, rows } = await fetchRows(PSE_BASE_V1, filter)
    _dbg.push({ base: PSE_BASE_V1, filter, url, count: rows.length })
    if (rows.length) {
      for (const r of rows) { const p = mapRow(r); if (p) out.set(p[0], p[1]) }
      if (!wantDebug) return out
      break
    }
  }

  // 4) ostateczny fallback: ostatnie 500 bez filtra (v2, potem v1) + filtr po stronie serwera
  if (out.size === 0) {
    for (const base of [PSE_BASE_V2, PSE_BASE_V1]) {
      const { url, rows } = await fetchRows(base, undefined, 500)
      _dbg.push({ base, filter: '(no $filter, $top=500)', url, count: rows.length })
      if (rows.length) {
        for (const r of rows) {
          const p = mapRow(r); if (!p) continue
          const t = new Date(p[0]).getTime()
          if (t >= new Date(fromISO).getTime() && t < new Date(toExclusiveISO).getTime()) {
            out.set(p[0], p[1])
          }
        }
        if (out.size) break
      }
    }
  }

  // opcjonalny globalny debug (do użycia z route debugującym)
  ;(globalThis as any).__rce_dbg__ = { range: { fromISO, toISO, toExclusiveISO }, tried: _dbg }
  return out
}

/** Debug helper do route: zwróci listę prób z ostatniego wywołania powyżej */
export function readLastRceDebug(): RceFetchDebug | null {
  return (globalThis as any).__rce_dbg__ || null
}
