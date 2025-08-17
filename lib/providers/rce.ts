// lib/providers/rce.ts
// Pobieranie RCE (PLN/kWh) z API PSE z wieloma wariantami filtrów i „przeglądarkowymi” nagłówkami.
// Zwraca Mapę: klucz = ISO (pełna godzina UTC), wartość = cena PLN/kWh (może być ujemna).

type RceRowRaw = {
  period_utc?: string
  rce_pln?: number | string
  // czasem API potrafi zwrócić tylko udtczas/dtime – zostawiamy tu miejsce na rozwinięcie
  udtczas?: string
  dtime?: string
}

const V2 = 'https://api.raporty.pse.pl/api/rce-pln'
const V1 = 'https://v1.api.raporty.pse.pl/api/rce-pln'

/** „Browser-like” nagłówki + profil OData v4. */
function rceHeaders() {
  const h: Record<string, string> = {
    'Accept': 'application/json;odata.metadata=minimal',
    'OData-Version': '4.0',
    'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
    // część serwerów PSE akceptuje filtry tylko z „prawdziwym” pochodzeniem
    'Origin': 'https://raporty.pse.pl',
    'Referer': 'https://raporty.pse.pl/',
    'X-Requested-With': 'XMLHttpRequest',
  }
  return h
}

/** Przygotuj listę kandydatów URL dla danej doby (v2 i v1) + bulk fallback. */
function buildCandidateUrls(dayStr: string) {
  // zakres UTC po godzinach (dla variantu z period_utc)
  const day = new Date(`${dayStr}T00:00:00Z`)
  const next = new Date(day.getTime() + 24 * 3600_000)
  const fromIso = day.toISOString().replace('.000Z', 'Z')
  const toIso = next.toISOString().replace('.000Z', 'Z')

  const commonSel = `$select=period_utc,rce_pln&$orderby=period_utc%20asc&$top=500`
  // Uwaga: kodujemy spacje jako %20 i enkapsulujemy daty pojedynczymi apostrofami
  const q = (filter: string) => `${commonSel}&$filter=${encodeURIComponent(filter)}`

  const v2 = [
    // business_date – wg maps PDF powinno działać
    `${V2}?${q(`business_date eq '${dayStr}'`)}`,
    // alternatywnie „doba”
    `${V2}?${q(`doba eq '${dayStr}'`)}`,
    // udtczas (varchar) w PL – najczęściej akceptowane w v2
    `${V2}?${q(`udtczas ge '${dayStr} 00:00' and udtczas le '${dayStr} 23:59'`)}`,
    // period_utc (DateTimeOffset) w pełnym ISO (bez wrappera datetimeoffset'...')
    `${V2}?${q(`period_utc ge ${`datetimeoffset'${fromIso}'`} and period_utc le ${`datetimeoffset'${toIso}'`}`)}`,
  ]

  const v1 = [
    `${V1}?${q(`doba eq '${dayStr}'`)}`,
    `${V1}?${q(`udtczas_oreb ge '${dayStr} 00:00' and udtczas_oreb le '${dayStr} 23:59'`)}`,
    `${V1}?${q(`period_utc ge ${`datetimeoffset'${fromIso}'`} and period_utc le ${`datetimeoffset'${toIso}'`}`)}`,
  ]

  // bulk – gdy filtry nie działają / odrzucane
  const bulk = [
    `${V2}?$select=period_utc,rce_pln&$orderby=period_utc%20desc&$top=2000`,
    `${V1}?$select=period_utc,rce_pln&$orderby=period_utc%20desc&$top=2000`,
  ]

  return { v2, v1, bulk, fromIso, toIso }
}

/** Normalizacja liczby (czasem przychodzi string z przecinkiem). */
function toNumber(x: any): number {
  if (x == null) return 0
  if (typeof x === 'number') return x
  if (typeof x === 'string') {
    const s = x.replace(',', '.').trim()
    const n = Number(s)
    return isFinite(n) ? n : 0
  }
  const n = Number(x)
  return isFinite(n) ? n : 0
}

/** Wspólny fetch z nagłówkami i delikatnym timeoutem. */
async function httpGet(url: string, signal?: AbortSignal) {
  const res = await fetch(url, {
    headers: rceHeaders(),
    method: 'GET',
    // revalidate: pozwalamy edge’owi cache’ować krótko, żeby nie „dusić” API
    next: { revalidate: 60 },
    signal,
  })
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch { body = null }
  return { ok: res.ok, status: res.status, body, text }
}

/** Wyciągnij tablicę rekordów z odpowiedzi OData (value[] lub korzeń []). */
function rowsFromBody(body: any): RceRowRaw[] {
  if (!body) return []
  if (Array.isArray(body)) return body as RceRowRaw[]
  if (Array.isArray(body?.value)) return body.value as RceRowRaw[]
  return []
}

/** Spreparuj klucz godziny: pełna godzina w UTC (ISO). */
function hourKeyFromPeriodUtc(period_utc: string): string | null {
  const d = new Date(period_utc)
  if (isNaN(d.getTime())) return null
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

/** Filtrowanie „bulk” do doby dayStr (UTC). */
function inDay(dayStr: string, isoKey: string) {
  return isoKey.startsWith(dayStr) // „YYYY-MM-DDT…”
}

/**
 * Główna funkcja: mapa { ISO_UTC_godzina -> cena PLN/kWh }.
 * – jeśli wszystkie filtry zwrócą 400, użyje bulk i lokalnego ucięcia do doby.
 */
export async function fetchRcePlnMap(fromISO: string, toISO: string): Promise<Map<string, number>> {
  // Działamy po DOBACH – /api/data już woła nas po dobie; dla bezpieczeństwa obetnijmy do from..to
  // i tak scalamy po godzinach w /api/data.
  const day = new Date(fromISO)
  const y = day.getUTCFullYear()
  const m = String(day.getUTCMonth() + 1).padStart(2, '0')
  const d = String(day.getUTCDate()).padStart(2, '0')
  const dayStr = `${y}-${m}-${d}`

  const { v2, v1, bulk } = buildCandidateUrls(dayStr)

  // timeout 6 s łącznie na próbę ścieżki (żeby nie blokować całej odpowiedzi)
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 6000)

  // spróbuj po kolei: v2 -> v1 -> bulk
  const order = [...v2, ...v1, ...bulk]
  let picked: RceRowRaw[] = []

  for (const url of order) {
    try {
      const { ok, status, body } = await httpGet(url, ac.signal)
      if (!ok) continue
      const rows = rowsFromBody(body)
      if (rows.length) {
        // jeśli to „bulk” – przytnij do naszej doby
        const isBulk = url.includes('$orderby=period_utc%20desc') || url.includes('$top=2000')
        const arr = isBulk
          ? rows.filter(r => {
              const key = r.period_utc ? hourKeyFromPeriodUtc(r.period_utc) : null
              return key ? inDay(dayStr, key.slice(0, 10)) : false
            })
          : rows
        if (arr.length) {
          picked = arr
          break
        }
      }
    } catch {
      // ignorujemy – lecimy dalej
    }
  }

  clearTimeout(t)

  const map = new Map<string, number>()
  for (const r of picked) {
    const key = r.period_utc ? hourKeyFromPeriodUtc(r.period_utc) : null
    if (!key) continue
    const price = toNumber(r.rce_pln)
    map.set(key, price)
  }

  // Na końcu: jeśli nic nie złapaliśmy – oddaj pustą mapę (API /api/data ustawi wtedy price=0)
  return map
}
