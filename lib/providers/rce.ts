// lib/providers/rce.ts
const TZ = 'Europe/Warsaw'
const API_BASE = 'https://api.raporty.pse.pl'
const PATH = '/api/rce-pln'

type RceRow = { timestamp: string; pln_per_kwh: number }

/** Pomocniczo: początek godziny (PL) → ISO */
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(seed)
  const Y = Number(parts.find((p) => p.type === 'year')!.value)
  const M = Number(parts.find((p) => p.type === 'month')!.value)
  const D = Number(parts.find((p) => p.type === 'day')!.value)
  const H = Number(parts.find((p) => p.type === 'hour')!.value)
  return new Date(Date.UTC(Y, M - 1, D, H, 0, 0)).toISOString()
}

/** YYYY-MM-DD w strefie PL dla danego ISO */
function ymdPL(iso: string) {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', { // en-CA => YYYY-MM-DD
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const Y = parts.find(p => p.type === 'year')!.value
  const M = parts.find(p => p.type === 'month')!.value
  const D = parts.find(p => p.type === 'day')!.value
  return `${Y}-${M}-${D}`
}

/** Mapowanie odpowiedzi /rce-pln na 24 wiersze godzinowe (PLN/kWh) */
function mapRceValueToRows(obj: any): RceRow[] {
  // Najczęstszy kształt: { value: [ { doba: 'YYYY-MM-DD', rce_pln: [PLN/MWh x24], ... } ] }
  const rec = Array.isArray(obj?.value) ? obj.value[0] : null
  if (rec && Array.isArray(rec.rce_pln) && rec.rce_pln.length) {
    const [y, m, d] = String(rec.doba || rec.Date || '').split('-').map(Number)
    const rows: RceRow[] = []
    for (let h = 0; h < 24; h++) {
      const plnMWh = Number(rec.rce_pln[h] ?? rec.RCE?.[h] ?? 0)
      const plnPerKwh = isFinite(plnMWh) ? plnMWh / 1000 : 0
      rows.push({ timestamp: isoForWarsawHour(y, (m || 1) - 1, d || 1, h), pln_per_kwh: plnPerKwh })
    }
    return rows
  }

  // Alternatywny kształt: value = tablica rekordów godzinowych { doba, oreb|period (1..24), rce_pln }
  if (Array.isArray(obj?.value) && obj.value.length) {
    const first = obj.value[0]
    const [y, m, d] = String(first.doba || first.Date || '').split('-').map(Number)
    const byHour: Record<number, number> = {}
    for (const r of obj.value) {
      const idx = Number(r.oreb ?? r.period ?? r.hour ?? 0) // 1..24
      const plnMWh = Number(r.rce_pln ?? r.RCE ?? 0)
      if (idx >= 1 && idx <= 24 && isFinite(plnMWh)) byHour[idx - 1] = plnMWh / 1000
    }
    const rows: RceRow[] = []
    for (let h = 0; h < 24; h++) {
      rows.push({ timestamp: isoForWarsawHour(y, (m || 1) - 1, d || 1, h), pln_per_kwh: byHour[h] ?? 0 })
    }
    return rows
  }

  throw new Error('Nieznany format odpowiedzi PSE /rce-pln')
}

/** Publiczne API – pobiera ceny RCE (PLN/kWh) dla zakresu from..to (obsługa doby/dób) */
export async function fetchRceHourlyPln(fromISO: string, toISO: string): Promise<RceRow[]> {
  // RCE jest publikowane per doba handlowa → iterujemy po dobach w strefie PL
  const out: RceRow[] = []
  const start = new Date(fromISO)
  const end = new Date(toISO)

  // zrób listę dat YYYY-MM-DD w strefie PL
  const dates = new Set<string>()
  let cursor = new Date(start)
  while (cursor < end) {
    dates.add(ymdPL(cursor.toISOString()))
    cursor.setUTCHours(cursor.getUTCHours() + 12) // przeskok w bezpieczny sposób
    // normalizuj na północ PL danego dnia:
    const ymd = ymdPL(cursor.toISOString()).split('-').map(Number)
    cursor = new Date(Date.UTC(ymd[0], ymd[1]-1, ymd[2], 0,0,0))
  }

  for (const day of Array.from(dates.values())) {
    const url = new URL(PATH, API_BASE)
    url.searchParams.set('$filter', `doba eq '${day}'`)
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, next: { revalidate: 300 } })
    const text = await res.text()
    if (!res.ok) throw new Error(`PSE RCE HTTP ${res.status} — ${text.slice(0,200)}`)
    let json: any
    try { json = JSON.parse(text) } catch { throw new Error(`PSE RCE zwrócił nie-JSON: ${text.slice(0,120)}`) }
    const rows = mapRceValueToRows(json)
    out.push(...rows)
  }

  // przefiltruj do żądanego przedziału
  return out
    .filter(r => {
      const t = new Date(r.timestamp).getTime()
      return t >= new Date(fromISO).getTime() && t < new Date(toISO).getTime()
    })
    .sort((a,b) => a.timestamp.localeCompare(b.timestamp))
}

export default fetchRceHourlyPln
