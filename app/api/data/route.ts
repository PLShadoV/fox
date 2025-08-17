// app/api/data/route.ts
import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'
import { fetchRcePlnHourly } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = { ts: string; kwh: number; price: number; revenue: number }
const TZ = 'Europe/Warsaw'

/* ----------------------- CZAS: PL -> UTC (z DST) ----------------------- */

/** oblicz offset (minuty) strefy PL dla TEJ lokalnej daty/godziny */
function offsetMinFor(y: number, m1: number, d: number, h = 0, mi = 0) {
  // „próba” – chwila odpowiadająca lokalnej dacie/godzinie (bez offsetu)
  const probe = new Date(Date.UTC(y, m1, d, h, mi, 0, 0))
  // pobierz skrót strefy z GMT±HH[:MM]
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).format(probe)
  const m = s.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!m) {
    // fallback: lato ~ +120, zima ~ +60
    return [3,4,5,6,7,8,9].includes(m1) ? 120 : 60
  }
  const sign = m[1].startsWith('-') ? -1 : 1
  const hh = Math.abs(parseInt(m[1], 10))
  const mm = m[2] ? parseInt(m[2], 10) : 0
  return sign * (hh * 60 + mm)
}

/** zwróć instant UTC (ISO) odpowiadający lokalnej godzinie/minucie w PL */
function isoPL(y: number, m1: number, d: number, H = 0, M = 0, S = 0, ms = 0) {
  const off = offsetMinFor(y, m1, d, H, M)
  const utcMs = Date.UTC(y, m1, d, H, M, S, ms) - off * 60_000
  return new Date(utcMs).toISOString()
}

/** początek/koniec DOBY PL (jako instanty UTC) dla dowolnej daty */
function dayBoundsPL(dt: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(dt)
  const get = (t: string) => Number(p.find(x => x.type === t)!.value)
  const y = get('year'), m = get('month'), d = get('day')
  return {
    start: isoPL(y, m - 1, d, 0, 0, 0, 0),
    end:   isoPL(y, m - 1, d, 23, 59, 59, 999),
  }
}

/** elastyczne wejście (ISO, `dd.MM.yyyy HH:mm`, `yyyy-MM-dd HH:mm`, same daty) → instant UTC */
function parseFlexible(input: string | null | undefined, which: 'start'|'end'): string {
  if (!input) return ''
  let s = decodeURIComponent(String(input)).trim()

  // ISO?
  {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // dd.MM.yyyy [HH:mm]
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (m) {
    const D = +m[1], M = +m[2], Y = +m[3]
    const H = m[4] ? +m[4] : (which === 'start' ? 0 : 23)
    const Min = m[5] ? +m[5] : (which === 'start' ? 0 : 59)
    return isoPL(Y, M - 1, D, H, Min, which === 'start' ? 0 : 59, which === 'start' ? 0 : 999)
  }

  // yyyy-MM-dd [HH:mm]
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
  if (m) {
    const Y = +m[1], M = +m[2], D = +m[3]
    const H = m[4] ? +m[4] : (which === 'start' ? 0 : 23)
    const Min = m[5] ? +m[5] : (which === 'start' ? 0 : 59)
    return isoPL(Y, M - 1, D, H, Min, which === 'start' ? 0 : 59, which === 'start' ? 0 : 999)
  }

  return ''
}

/** kolejne „początki dób” PL (jako instanty UTC) dla zakresu */
function enumerateMidnightsPL(fromISO: string, toISO: string) {
  const start = new Date(fromISO)
  const end = new Date(toISO)
  const s = dayBoundsPL(start).start  // lokalna północ PL → UTC
  const e = dayBoundsPL(end).start
  const out: string[] = []
  for (let t = new Date(s).getTime(); t <= new Date(e).getTime(); t += 24 * 3600_000) {
    out.push(new Date(t).toISOString())
  }
  return out
}

/* --------------------------- CACHE na 60 s --------------------------- */

type CacheEntry = { ts: number; rows: Row[]; stats?: any }
const DATA_TTL_MS = 60_000
const g = globalThis as any
g.__data_cache ||= new Map<string, CacheEntry>()

/* ------------------------------- ROUTE ------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const wantDebug = searchParams.get('debug') === '1'

    // zakres wejściowy (domyślnie: bieżąca doba PL)
    const now = new Date()
    const def = dayBoundsPL(now)
    const from = parseFlexible(searchParams.get('from'), 'start') || def.start
    const to   = parseFlexible(searchParams.get('to'),   'end')   || def.end

    const key = `${from}|${to}`
    const cached = g.__data_cache.get(key)
    if (cached && Date.now() - cached.ts < DATA_TTL_MS) {
      return new Response(JSON.stringify({ ok: true, rows: cached.rows, ...(wantDebug ? { stats: cached.stats } : {}) }, null, 2), {
        headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
      })
    }

    // 1) energia z FoxESS – dzień po dniu (godziny w PL → ISO UTC)
    const dayStarts = enumerateMidnightsPL(from, to)
    let energy: { ts: string; kwh: number }[] = []
    for (const dayStart of dayStarts) {
      const endOfDay = new Date(new Date(dayStart).getTime() + 24*3600_000 - 1).toISOString()
      const points = await fetchFoxEssHourlyExported(dayStart, endOfDay)
      energy.push(...points.map(p => ({ ts: p.timestamp, kwh: Number(p.exported_kwh || 0) })))
    }
    // utnij do żądanego zakresu
    energy = energy.filter(e => {
      const t = new Date(e.ts).getTime()
      return t >= new Date(from).getTime() && t <= new Date(to).getTime()
    })
    energy.sort((a,b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    // 2) ceny RCE PLN/kWh dla tych samych godzin (też liczone po dobie PL)
    const rce = await fetchRcePlnHourly(from, to) // Map<ISO-PL-hour, price>

    // 3) merge – ujemną cenę pokazujemy, ale revenue liczymy z max(price, 0)
    const rows: Row[] = energy.map(e => {
      const price = rce.get(e.ts) ?? 0
      const eff = Math.max(price, 0)
      return { ts: e.ts, kwh: e.kwh, price, revenue: eff * e.kwh }
    })

    const stats = wantDebug ? {
      hoursEnergy: energy.length,
      rceHits: [...rce.keys()].length,
      firstHour: rows[0]?.ts,
      lastHour: rows[rows.length - 1]?.ts
    } : undefined

    g.__data_cache.set(key, { ts: Date.now(), rows, stats })
    return new Response(JSON.stringify({ ok: true, rows, ...(wantDebug ? { stats } : {}) }, null, 2), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'data error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
