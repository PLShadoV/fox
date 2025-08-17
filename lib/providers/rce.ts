// lib/providers/rce.ts
const RCE_API = 'https://api.raporty.pse.pl/api/rce-pln'
const TZ = 'Europe/Warsaw'

// identyczna funkcja czasu jak w foxess.ts
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const guess = new Date(Date.UTC(y, m1, d, h, 0, 0, 0))
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).format(guess)
  const m = s.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  let offsetMin = 0
  if (m) {
    const sign = m[1].startsWith('-') ? -1 : 1
    const hh = Math.abs(parseInt(m[1], 10))
    const mm = m[2] ? parseInt(m[2], 10) : 0
    offsetMin = sign * (hh * 60 + mm)
  } else {
    offsetMin = [3,4,5,6,7,8,9].includes(m1) ? 120 : 60
  }
  return new Date(Date.UTC(y, m1, d, h) - offsetMin * 60_000).toISOString()
}

// YYYY-MM-DD w PL
function ymdPl(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** RCE dla jednej doby PL → mapa: ISO-godzina → PLN/kWh */
async function fetchRceDay(ymd: string): Promise<Map<string, number>> {
  const url = new URL(RCE_API)
  url.searchParams.set('$filter', `(business_date eq '${ymd}' or doba eq '${ymd}')`)
  url.searchParams.set('$select', 'udtczas_oreb,rce_pln,business_date,doba')
  url.searchParams.set('$orderby', 'udtczas_oreb asc')
  url.searchParams.set('$top', '200')

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`RCE HTTP ${res.status} — ${text.slice(0, 160)}`)
  const json = JSON.parse(text)
  const rows = Array.isArray(json?.value) ? json.value : []

  const map = new Map<string, number>()
  for (const r of rows) {
    // "YYYY-MM-DD HH:mm[...]"
    const m = String(r.udtczas_oreb || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/)
    if (!m) continue
    const Y = Number(m[1]), M = Number(m[2]), D = Number(m[3]), H = Number(m[4])
    const key = isoForWarsawHour(Y, M - 1, D, H)
    const price = Number(r.rce_pln ?? 0) / 1000 // PLN/MWh → PLN/kWh
    map.set(key, Number.isFinite(price) ? price : 0)
  }
  return map
}

export async function fetchRcePlnHourly(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const from = new Date(fromISO)
  const to = new Date(toISO)
  const { y: fy, m: fm, d: fd } = ymdPl(from)
  let cursor = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0))
  const out = new Map<string, number>()
  while (cursor.getTime() <= to.getTime()) {
    const { y, m, d } = ymdPl(cursor)
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try { (await fetchRceDay(ymd)).forEach((v, k) => out.set(k, v)) } catch {}
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return out
}
