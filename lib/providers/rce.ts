// lib/providers/rce.ts
// RCE – ceny godzinowe PLN/kWh z API PSE (OData v2)

const RCE_API = 'https://api.raporty.pse.pl/api/rce-pln'

// ISO instant odpowiadający lokalnej godzinie Europe/Warsaw
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  return new Date(Date.UTC(y, m1, d, h, 0, 0, 0)).toISOString()
}

// YYYY-MM-DD w Europe/Warsaw dla podanej chwili
function ymdPl(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** RCE dla jednej doby PL → mapa: ISO-godzina → PLN/kWh */
async function fetchRceDay(ymd: string): Promise<Map<string, number>> {
  const url = new URL(RCE_API)
  // Działa i dla nowszego pola business_date, i dla starszego doba
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
    // 🔑 KLUCZOWE: parsujemy ręcznie YYYY-MM-DD[ T]HH:mm jako godzinę PL (bez użycia Date(..) w strefie serwera)
    const m = String(r.udtczas_oreb || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/)
    if (!m) continue
    const Y = Number(m[1]), M = Number(m[2]), D = Number(m[3]), H = Number(m[4])
    const key = isoForWarsawHour(Y, M - 1, D, H)

    // PLN/MWh → PLN/kWh
    const raw = r.rce_pln ?? r.rce ?? r.RCE_PLN ?? 0
    const price = Number(raw) / 1000
    map.set(key, isFinite(price) ? price : 0)
  }
  return map
}

/** Publiczne: RCE w godzinach dla zakresu */
export async function fetchRcePlnHourly(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const from = new Date(fromISO)
  const to = new Date(toISO)

  // enumeracja dób PL
  const { y: fy, m: fm, d: fd } = ymdPl(from)
  let cursor = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0))

  const result = new Map<string, number>()
  while (cursor.getTime() <= to.getTime()) {
    const { y, m, d } = ymdPl(cursor)
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try {
      const dayMap = await fetchRceDay(ymd)
      dayMap.forEach((v, k) => result.set(k, v))
    } catch {
      // Pomiń pojedynczy błąd doby (np. brak publikacji)
    }
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return result
}
