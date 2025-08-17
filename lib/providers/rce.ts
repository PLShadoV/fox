// lib/providers/rce.ts
const TZ = 'Europe/Warsaw'
const API_BASE = 'https://api.raporty.pse.pl'
const PATH = '/api/rce-pln'

type RceRow = { timestamp: string; pln_per_kwh: number }

/** ISO PL hour */
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

async function fetchDay(field: 'Date' | 'doba', day: string) {
  const url = new URL(PATH, API_BASE)
  url.searchParams.set('$filter', `${field} eq '${day}'`)
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, next: { revalidate: 300 } })
  const txt = await res.text()
  return { ok: res.ok, status: res.status, txt }
}

function mapJsonToRows(json: any, y: number, m: number, d: number): RceRow[] {
  // shape 1: value[0].rce_pln = [24 * PLN/MWh]
  if (Array.isArray(json?.value) && json.value.length && Array.isArray(json.value[0]?.rce_pln)) {
    const arr = json.value[0].rce_pln
    const rows: RceRow[] = []
    for (let h = 0; h < 24; h++) {
      const plnMWh = Number(arr[h] ?? 0)
      rows.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: isFinite(plnMWh) ? plnMWh / 1000 : 0 })
    }
    return rows
  }
  // shape 2: value = hourly records
  if (Array.isArray(json?.value)) {
    const byHour: Record<number, number> = {}
    for (const r of json.value) {
      const idx = Number(r.oreb ?? r.period ?? r.hour ?? 0) // 1..24
      const plnMWh = Number(r.rce_pln ?? r.RCE ?? 0)
      if (idx >= 1 && idx <= 24 && isFinite(plnMWh)) byHour[idx - 1] = plnMWh / 1000
    }
    const rows: RceRow[] = []
    for (let h = 0; h < 24; h++) rows.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: byHour[h] ?? 0 })
    return rows
  }
  return []
}

/** Publiczne API – RCE PLN/kWh dla zakresu (iteracja po dobach PL) */
export async function fetchRceHourlyPln(fromISO: string, toISO: string): Promise<RceRow[]> {
  const out: RceRow[] = []
  const start = new Date(fromISO)
  const end = new Date(toISO)

  // Zbuduj listę dni YYYY-MM-DD (PL)
  const dates: string[] = []
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  let cur = new Date(start)
  while (cur < end) {
    const parts = fmt.formatToParts(cur)
    const Y = parts.find(p => p.type === 'year')!.value
    const M = parts.find(p => p.type === 'month')!.value
    const D = parts.find(p => p.type === 'day')!.value
    const day = `${Y}-${M}-${D}`
    if (!dates.includes(day)) dates.push(day)
    cur.setUTCHours(cur.getUTCHours() + 12)
  }

  for (const day of dates) {
    const [y, m, d] = day.split('-').map(Number)
    // najpierw spróbuj v2 (Date)
    let resp = await fetchDay('Date', day)
    if (!resp.ok) {
      // fallback do v1 (doba)
      resp = await fetchDay('doba', day)
      if (!resp.ok) throw new Error(`PSE RCE HTTP ${resp.status} — ${resp.txt.slice(0, 200)}`)
    }
    let json: any
    try { json = JSON.parse(resp.txt) } catch { throw new Error(`PSE RCE zwrócił nie-JSON: ${resp.txt.slice(0,160)}`) }
    out.push(...mapJsonToRows(json, y, m, d))
  }

  // filtr do żądanego zakresu
  const f = out.filter(r => {
    const t = +new Date(r.timestamp)
    return t >= +new Date(fromISO) && t < +new Date(toISO)
  })
  return f.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export default fetchRceHourlyPln
