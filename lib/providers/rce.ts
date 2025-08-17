// lib/providers/rce.ts
const RCE_API = 'https://api.raporty.pse.pl/api/rce-pln'

function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  return new Date(Date.UTC(y, m1, d, h, 0, 0, 0)).toISOString()
}
function partsPL(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day'), H: get('hour') }
}

async function fetchRceForDayPl(ymd: string): Promise<Map<string, number>> {
  const url = new URL(RCE_API)
  // 🔧 kluczowa poprawka: 'business_date', nie 'doba'
  url.searchParams.set('$filter', `business_date eq '${ymd}'`)
  url.searchParams.set('$select', 'udtczas_oreb,rce_pln,business_date')
  url.searchParams.set('$orderby', 'udtczas_oreb asc')
  url.searchParams.set('$top', '200')

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`RCE HTTP ${res.status} — ${text.slice(0, 160)}`)
  const json = JSON.parse(text)
  const rows = Array.isArray(json?.value) ? json.value : []
  const map = new Map<string, number>()

  for (const r of rows) {
    const stamp = String(r.udtczas_oreb || '').replace(' ', 'T').slice(0, 16) // "YYYY-MM-DDTHH:mm"
    const d = new Date(stamp)         // interpretacja lokalna (PL)
    const { y, m, d: day, H } = partsPL(d)
    const key = isoForWarsawHour(y, m - 1, day, H)
    const plnPerKwh = Number(r.rce_pln) / 1000 // PLN/MWh -> PLN/kWh
    map.set(key, isFinite(plnPerKwh) ? plnPerKwh : 0)
  }
  return map
}

export async function fetchRcePlnHourly(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const from = new Date(fromISO)
  const to = new Date(toISO)

  // enumeruj doby PL
  const first = new Date(from)
  const { y: fy, m: fm, d: fd } = partsPL(first)
  let cursor = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0))
  const result = new Map<string, number>()

  while (cursor.getTime() <= to.getTime()) {
    const { y, m, d } = partsPL(cursor)
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try {
      const mday = await fetchRceForDayPl(ymd)
      mday.forEach((v, k) => result.set(k, v))
    } catch { /* pomiń pojedyncze błędy doby */ }
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return result
}
