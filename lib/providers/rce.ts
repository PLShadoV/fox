// lib/providers/rce.ts
const TZ = 'Europe/Warsaw'
const API_BASE = 'https://api.raporty.pse.pl'
const PATH = '/api/rce-pln'

type RceRow = { timestamp: string; pln_per_kwh: number }

/** ISO dla początku godziny w PL */
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

async function fetchDayRaw(field: 'Date' | 'doba', day: string) {
  const url = new URL(PATH, API_BASE)
  url.searchParams.set('$filter', `${field} eq '${day}'`)
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, next: { revalidate: 300 } })
  const txt = await res.text()
  return { ok: res.ok, status: res.status, txt }
}

function mapJsonToRows(json: any, y: number, m: number, d: number): RceRow[] {
  // wariant 1: value[0].rce_pln = [24 * PLN/MWh]
  if (Array.isArray(json?.value) && json.value.length && Array.isArray(json.value[0]?.rce_pln)) {
    const arr = json.value[0].rce_pln
    const out: RceRow[] = []
    for (let h = 0; h < 24; h++) {
      const plnMWh = Number(arr[h] ?? 0)
      out.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: isFinite(plnMWh) ? plnMWh / 1000 : 0 })
    }
    return out
  }
  // wariant 2: value = tablica rekordów godzinowych
  if (Array.isArray(json?.value)) {
    const byHour: Record<number, number> = {}
    for (const r of json.value) {
      const idx = Number(r.oreb ?? r.period ?? r.hour ?? 0) // 1..24
      const plnMWh = Number(r.rce_pln ?? r.RCE ?? 0)
      if (idx >= 1 && idx <= 24 && isFinite(plnMWh)) byHour[idx - 1] = plnMWh / 1000
    }
    const out: RceRow[] = []
    for (let h = 0; h < 24; h++) out.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: byHour[h] ?? 0 })
    return out
  }
  return []
}

/** Publiczne API – RCE PLN/kWh dla zakresu from..to (iteracja po dobach PL) */
export async function fetchRceHourlyPln(fromISO: string, toISO: string): Promise<RceRow[]> {
  const out: RceRow[] = []
  const start = new Date(fromISO)
  const end = new Date(toISO)

  // zbierz dni YYYY-MM-DD w strefie PL
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dates: string[] = []
  for (let cur = new Date(start); cur < end; cur.setUTCHours(cur.getUTCHours() + 12)) {
    const parts = fmt.formatToParts(cur)
    const Y = parts.find(p => p.type === 'year')!.value
    const M = parts.find(p => p.type === 'month')!.value
    const D = parts.find(p => p.type === 'day')!.value
    const day = `${Y}-${M}-${D}`
    if (!dates.includes(day)) dates.push(day)
  }

  for (const day of dates) {
    const [y, m, d] = day.split('-').map(Number)
    // najpierw v2 (Date), w razie 400 fallback v1 (doba)
    let resp = await fetchDayRaw('Date', day)
    if (!resp.ok) {
      resp = await fetchDayRaw('doba', day)
      if (!resp.ok) throw new Error(`PSE RCE HTTP ${resp.status} — ${resp.txt.slice(0, 200)}`)
    }
    let json: any
    try { json = JSON.parse(resp.txt) } catch { throw new Error(`PSE RCE zwrócił nie-JSON: ${resp.txt.slice(0, 160)}`) }
    out.push(...mapJsonToRows(json, y, m, d))
  }

  return out
    .filter(r => +new Date(r.timestamp) >= +new Date(fromISO) && +new Date(r.timestamp) < +new Date(toISO))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export default fetchRceHourlyPln
