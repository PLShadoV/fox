// lib/providers/rce.ts
/**
 * Pobieranie RCE (PLN/kWh) z PSE v2.
 * Strategia:
 *  - filtrujemy po udtczas (lokalny czas, string) w formacie 'YYYY-MM-DD HH:mm'
 *  - wybieramy i łączymy po period_utc (UTC, jedna wartość na godzinę)
 *  - wynik zwracamy jako Map<ISO_UTC_godzina, cenaPLN>
 *
 * Źródła pól (rce-pln): udtczas, udtczas_oreb, period_utc, rce_pln.
 */

const API_BASE = process.env.RCE_API_BASE?.trim() || 'https://api.raporty.pse.pl/api'

// -------------- pomocnicze: czas/strefa ---------------

const TZ = 'Europe/Warsaw'

function ymdPL(d: Date): string {
  // zwraca 'YYYY-MM-DD' dla strefy PL
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function* daysPL(fromISO: string, toISO: string) {
  // generator unikalnych dni (w sensie PL) w zadanym zakresie
  const seen = new Set<string>()
  const start = new Date(fromISO)
  const end = new Date(toISO)
  for (let t = new Date(start); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
    const key = ymdPL(t)
    if (!seen.has(key)) {
      seen.add(key)
      yield key
    }
  }
}

function isoHourUTC(d: Date) {
  const x = new Date(d)
  x.setUTCMinutes(0, 0, 0)
  return x.toISOString()
}

// -------------- cache dnia (żeby nie dobijać API) ---------------

type DayCache = Map<string, { at: number; items: Array<{ iso: string; price: number }> }>
const g = globalThis as any
g.__rce_day_cache ||= new Map() as DayCache
const DAY_TTL_MS = 60 * 60 * 1000 // 1h – bezpiecznie, bo PSE publikuje z wyprzedzeniem

// -------------- fetch jednego dnia z v2 ---------------

async function fetchRceDayV2(day: string) {
  // filtrujemy stringowo po udtczas (lokalna), ale bierzemy period_utc do klucza
  const params = new URLSearchParams()
  params.set('$select', 'period_utc,rce_pln')
  params.set('$orderby', 'period_utc asc')
  params.set('$top', '500')
  params.set('$filter', `udtczas ge '${day} 00:00' and udtczas le '${day} 23:59'`)
  const url = `${API_BASE}/rce-pln?${params.toString()}`

  const res = await fetch(url, {
    // PSE lubi jawny JSON i brak cachowania po stronie node (my i tak cache’ujemy ręcznie)
    headers: { 'Accept': 'application/json' },
    // Next edge cache i tak ominie to, najważniejszy jest nasz cache in-memory
    next: { revalidate: 0 }
  })
  if (!res.ok) {
    throw new Error(`RCE v2 HTTP ${res.status}`)
  }
  const json: any = await res.json()
  const arr: any[] = Array.isArray(json?.value) ? json.value : []

  const items: Array<{ iso: string; price: number }> = []
  for (const row of arr) {
    let ts = String(row.period_utc ?? row.udtczas_oreb ?? '')
    if (!ts) continue

    // ujednolicenie TS -> ISO (czasem bywa 'YYYY-MM-DD HH:mm', czasem ISO)
    if (!ts.includes('T')) ts = ts.replace(' ', 'T')
    if (!/Z$/.test(ts)) {
      // jeżeli brak sufiksu – traktuj jako UTC (period_utc jest w UTC)
      ts = ts + 'Z'
    }
    const d = new Date(ts)
    if (isNaN(d.getTime())) continue

    const price = Number(row.rce_pln ?? row.rce ?? row.price)
    if (!isFinite(price)) continue

    items.push({ iso: isoHourUTC(d), price })
  }
  return items
}

// -------------- API eksportowane: mapa godzin ---------------

export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()

  for (const day of daysPL(fromISO, toISO)) {
    // cache dnia
    const hit = g.__rce_day_cache.get(day)
    if (hit && Date.now() - hit.at < DAY_TTL_MS) {
      for (const it of hit.items) out.set(it.iso, it.price)
      continue
    }

    try {
      const items = await fetchRceDayV2(day)
      g.__rce_day_cache.set(day, { at: Date.now(), items })
      for (const it of items) out.set(it.iso, it.price)
    } catch (e) {
      // jeżeli dzień nie zwrócił danych – zostaw pusty (część dni może jeszcze nie być opublikowana)
      g.__rce_day_cache.set(day, { at: Date.now(), items: [] })
    }
  }

  return out
}
