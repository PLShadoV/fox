// lib/providers/rce.ts
/**
 * Pobiera ceny RCE z PSE (V2) i zwraca mapę: ISO godziny (UTC) -> cena [PLN/kWh].
 * API zwraca rce_pln w PLN/MWh, więc dzielimy przez 1000.
 *
 * Kluczowe:
 *  - używamy filtra: $filter=doba eq 'YYYY-MM-DD'
 *  - spacje kodujemy jako %20 (nie '+'), bo inaczej serwer daje 400
 *  - godzinę bierzemy z period_utc (UTC, pasuje do naszych kluczy TS)
 */

const BASE_V2 = process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl'

// Bezpieczny fetch JSON
async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    // nie buforujemy długo – ceny mogą być publikowane z wyprzedzeniem
    next: { revalidate: 300 },
  })
  const txt = await res.text()
  if (!res.ok) {
    throw new Error(`RCE HTTP ${res.status} – ${txt.slice(0, 200)}`)
  }
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`RCE: niepoprawny JSON (${txt.slice(0, 120)})`)
  }
}

// YYYY-MM-DD z daty w PL (Europe/Warsaw)
function ymdWarsaw(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${day}`
}

// wszystkie dni (YYYY-MM-DD) między from..to liczone jako doby PL
function listDaysWarsaw(fromISO: string, toISO: string): string[] {
  // normalizujemy do północy PL
  const start = new Date(fromISO)
  const end = new Date(toISO)
  const days = new Set<string>()
  for (let t = new Date(start.getTime()); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
    days.add(ymdWarsaw(t))
  }
  return Array.from(days)
}

// PSE V2: rce-pln dla jednego dnia (YYYY-MM-DD)
async function fetchRceDayV2(dayYmd: string) {
  // WAŻNE: budujemy parametry ręcznie, żeby spacje były %20
  const filter = encodeURIComponent(`doba eq '${dayYmd}'`) // => doba%20eq%20'YYYY-MM-DD'
  const order = encodeURIComponent('period_utc asc')
  const url = `${BASE_V2}/api/rce-pln?$filter=${filter}&$orderby=${order}&$top=500`

  const json = await getJson(url)
  const arr: any[] = Array.isArray(json?.value) ? json.value : []
  return arr
}

/**
 * Publiczne API:
 * Zwraca Map<ISO_UTC_godziny, cena_PLN_na_kWh>
 * (pokazujemy ujemne ceny, ale ich użycie do revenue jest w /api/data – tam robimy max(price, 0))
 */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const days = listDaysWarsaw(fromISO, toISO)

  for (const day of days) {
    let rows: any[] = []
    try {
      rows = await fetchRceDayV2(day)
    } catch (e) {
      // nie wysypujemy całego zakresu – po prostu omiń ten dzień
      // (debug zostawiamy w logach Vercel)
      console.warn('RCE day fetch failed', day, (e as Error)?.message)
      continue
    }

    for (const r of rows) {
      // preferuj period_utc (UTC), w ostateczności dtime_utc
      const iso = r?.period_utc || r?.dtime_utc
      if (!iso) continue
      const ts = new Date(iso).toISOString()     // „klucz godziny” w UTC
      const plnMWh = Number(r?.rce_pln ?? r?.rcePLN ?? r?.RCE_PLN ?? 0)
      if (!isFinite(plnMWh)) continue
      const plnKWh = plnMWh / 1000
      out.set(ts, plnKWh)
    }
  }

  return out
}
