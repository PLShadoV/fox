// lib/providers/rce.ts
/**
 * Pobieranie RCE (Rynkowa Cena Energii) z API PSE:
 *  - OData: https://api.raporty.pse.pl/api/rce-pln
 *  - Filtrujemy per "doba" (YYYY-MM-DD)
 *
 * Pola wg mapowania PSE:
 *  - doba (business_date) – doba handlowa (YYYY-MM-DD)
 *  - udtczas_oreb / udtczas – znacznik czasu (lokalny; godzina dostawy)
 *  - rce_pln – cena w PLN/MWh (konwertujemy do PLN/kWh dzieląc przez 1000)
 *
 * Źródła/dowody:
 *  - API katalog v2: https://api.raporty.pse.pl/ (endpoint /api/rce-pln). :contentReference[oaicite:0]{index=0}
 *  - Przykłady użycia z filtrem: .../api/rce-pln?$filter=business_date eq 'YYYY-MM-DD' (społeczność). :contentReference[oaicite:1]{index=1}
 *  - Mapowanie pól endpointów (PDF): udtczas/udtczas_oreb, business_date, rce_pln. :contentReference[oaicite:2]{index=2}
 */

const RCE_API = 'https://api.raporty.pse.pl/api/rce-pln'

/** ISO „początek godziny” w Europe/Warsaw zwrócony jako instant (UTC ISO) */
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  // Konstrukcja instanta odpowiadającego lokalnej godzinie PL
  const dt = new Date(Date.UTC(y, m1, d, h, 0, 0, 0))
  return dt.toISOString()
}

/** YYYY-MM-DD w Europe/Warsaw dla podanej chwili */
function ymdWarsaw(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const g = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: g('year'), m: g('month'), d: g('day') }
}

/** Pobiera ceny RCE dla jednej doby (PL) i zwraca mapę: ISO-godzina → PLN/kWh */
async function fetchRceForDayPl(ymd: string): Promise<Map<string, number>> {
  // Przykład: ?$filter=doba eq '2025-02-16'&$select=udtczas_oreb,rce_pln,doba&$orderby=udtczas_oreb asc
  const url = new URL(RCE_API)
  url.searchParams.set('$filter', `doba eq '${ymd}'`)
  url.searchParams.set('$select', 'udtczas_oreb,rce_pln,doba')
  url.searchParams.set('$orderby', 'udtczas_oreb asc')
  url.searchParams.set('$top', '200')

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`RCE HTTP ${res.status} — ${text.slice(0, 160)}`)
  if (!ct.includes('application/json')) throw new Error(`RCE: nie-JSON (${ct}). Fragment: ${text.slice(0, 120)}`)

  const json = JSON.parse(text)
  const rows = Array.isArray(json?.value) ? json.value : []
  const map = new Map<string, number>()

  for (const r of rows) {
    // udtczas_oreb bywa w formacie "YYYY-MM-DDTHH:mm" albo "YYYY-MM-DD HH:mm"
    const stamp = String(r.udtczas_oreb || r.udtczas || '')
      .replace(' ', 'T')
      .slice(0, 16) // YYYY-MM-DDTHH:mm

    // Kluczujemy po początku godziny PL jako instant
    const d = new Date(stamp) // to jest lokalny czas PL (wg danych PSE)
    const { y, m, d: day } = ymdWarsaw(d)
    const h = d.getHours()
    const key = isoForWarsawHour(y, m - 1, day, h)

    // PLN/MWh -> PLN/kWh
    const pricePlnPerKwh = Number(r.rce_pln) / 1000
    map.set(key, isFinite(pricePlnPerKwh) ? pricePlnPerKwh : 0)
  }
  return map
}

/** Pobiera RCE dla wielu dób i zwraca jedną mapę ISO-godzina → PLN/kWh */
export async function fetchRcePlnHourly(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const from = new Date(fromISO)
  const to = new Date(toISO)

  // enumeracja dni PL
  const first = new Date(from)
  const lastStart = new Date(to)
  const { y: fy, m: fm, d: fd } = ymdWarsaw(first)
  let cursor = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0))

  const result = new Map<string, number>()
  while (cursor.getTime() <= lastStart.getTime()) {
    const { y, m, d } = ymdWarsaw(cursor)
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try {
      const mday = await fetchRceForDayPl(ymd)
      mday.forEach((v, k) => result.set(k, v))
    } catch (e) {
      // jeśli któryś dzień nie zwróci, lecimy dalej
      // console.error('RCE day error', ymd, e)
    }
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000)
  }
  return result
}
