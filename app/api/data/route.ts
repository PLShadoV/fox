// app/api/data/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ====== KONFIG ====== */
const TZ = 'Europe/Warsaw'
const FOX_BASE = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
const FOX_TOKEN = (process.env.FOXESS_API_TOKEN || '').trim()
const FOX_SN = (process.env.FOXESS_DEVICE_SN || '').trim()
// Domyślnie bierzemy eksport (feedin). Jeśli nie masz licznika eksportu,
// ustaw w Vercel/ENV: FOXESS_VARIABLE=generation
const FOX_VAR = (process.env.FOXESS_VARIABLE || 'feedin').toLowerCase()

/** ====== HELPERY CZASU ====== */
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(seed)
  const Y = Number(parts.find(p => p.type === 'year')!.value)
  const M = Number(parts.find(p => p.type === 'month')!.value)
  const D = Number(parts.find(p => p.type === 'day')!.value)
  const H = Number(parts.find(p => p.type === 'hour')!.value)
  return new Date(Date.UTC(Y, M - 1, D, H, 0, 0)).toISOString()
}

function parseDate(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('date') || searchParams.get('day') || searchParams.get('d')
  if (q) {
    const [y, m, d] = q.split('-').map(Number)
    return { y, m, d }
  }
  // domyślnie: wczoraj wg Warszawy
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const Y = Number(parts.find(p => p.type === 'year')!.value)
  const M = Number(parts.find(p => p.type === 'month')!.value)
  const D = Number(parts.find(p => p.type === 'day')!.value)
  const noon = new Date(Date.UTC(Y, M - 1, D, 12))
  noon.setUTCDate(noon.getUTCDate() - 1)
  return { y: noon.getUTCFullYear(), m: noon.getUTCMonth() + 1, d: noon.getUTCDate() }
}

/** ====== FOXESS (literalne "\\r\\n" w podpisie) ====== */
function foxHeaders(path: string, token: string) {
  const JOIN = '\\r\\n' // LITERALNE backslash-r backslash-n
  const timestamp = Date.now().toString()
  const toSign = `${path}${JOIN}${token}${JOIN}${timestamp}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'lang': 'en',
    'token': token.trim(),
    'timestamp': timestamp,
    'signature': signature
  } as Record<string, string>
}

async function foxessDay(y: number, m: number, d: number) {
  if (!FOX_TOKEN) throw new Error('Brak FOXESS_API_TOKEN')
  if (!FOX_SN) throw new Error('Brak FOXESS_DEVICE_SN')
  const path = '/op/v0/device/report/query'
  const url = new URL(path, FOX_BASE)
  const body = { sn: FOX_SN, year: y, month: m, day: d, dimension: 'day', variables: [FOX_VAR] }
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, FOX_TOKEN),
    body: JSON.stringify(body),
    cache: 'no-store' as any
  })
  const txt = await res.text()
  const ct = res.headers.get('content-type') || ''
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${txt.slice(0, 180)}`)
  if (!ct.includes('application/json')) throw new Error(`FoxESS content-type ${ct || 'brak'} — ${txt.slice(0, 160)}`)
  const json = JSON.parse(txt)
  if (typeof json?.errno === 'number' && json.errno !== 0) throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'API error'}`)

  const series = (json?.result || []).find((v: any) => String(v?.variable || '').toLowerCase() === FOX_VAR)?.values ?? []
  const out: Array<{ timestamp: string; exported_kwh: number }> = []
  for (let h = 0; h < 24; h++) {
    const val = Number(series[h] ?? 0)
    out.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), exported_kwh: isFinite(val) ? val : 0 })
  }
  return out
}

/** ====== RCE (jak w fox2) ======
 * Pierwsza próba: /api/rce-pln?$filter=Date eq 'YYYY-MM-DD'
 *  - jeśli payload ma value[0].rce_pln (tablica 24), to mapujemy 24h (PLN/MWh → PLN/kWh /1000)
 *  - fallback: jeśli przychodzi lista rekordów godzinowych, bierzemy rce_pln i godzinę z udtczas/period/oreb/hour
 * Druga próba (fallback): stary atrybut "doba".
 */
async function rceDay(y: number, m: number, d: number) {
  const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const base = 'https://api.raporty.pse.pl/api/rce-pln'

  // spróbuj wg "Date"
  let res = await fetch(`${base}?$filter=Date eq '${day}'`, {
    headers: { 'Accept': 'application/json;odata.metadata=none' } as any,
    cache: 'no-store' as any,
  })
  let txt = await res.text()
  if (!res.ok) {
    // fallback: "doba"
    res = await fetch(`${base}?$filter=doba eq '${day}'`, {
      headers: { 'Accept': 'application/json;odata.metadata=none' } as any,
      cache: 'no-store' as any,
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`PSE RCE HTTP ${res.status} — ${txt.slice(0, 200)}`)
  }

  let json: any
  try { json = JSON.parse(txt) } catch { throw new Error(`PSE RCE parse error — ${txt.slice(0, 200)}`) }
  return mapRce(json, y, m, d)
}

function mapRce(json: any, y: number, m: number, d: number) {
  const out: Array<{ timestamp: string; pln_per_kwh: number }> = []

  // wariant 1: value[0].rce_pln = [24 liczb w PLN/MWh]
  if (Array.isArray(json?.value) && json.value.length && Array.isArray(json.value[0]?.rce_pln)) {
    const arr = json.value[0].rce_pln
    for (let h = 0; h < 24; h++) {
      const plnMWh = Number(arr[h] ?? 0)
      out.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: isFinite(plnMWh) ? plnMWh / 1000 : 0 })
    }
    return out
  }

  // wariant 2: lista rekordów godzinowych (udtczas/period/oreb/hour + rce_pln)
  if (Array.isArray(json?.value)) {
    const byHour: Record<number, number> = {}
    for (const r of json.value) {
      // Godzina może być w "udtczas" (datetime) lub w indeksie (1..24)
      let idx = Number(r.oreb ?? r.period ?? r.hour ?? 0) // 1..24
      if (!idx && r.udtczas) {
        const t = new Date(String(r.udtczas))
        idx = t instanceof Date && !isNaN(+t) ? t.getHours() + 1 : 0 // zamieniamy 0..23 → 1..24
      }
      const plnMWh = Number(r.rce_pln ?? r.RCE ?? 0)
      if (idx >= 1 && idx <= 24 && isFinite(plnMWh)) byHour[idx - 1] = plnMWh / 1000
    }
    for (let h = 0; h < 24; h++) {
      out.push({ timestamp: isoForWarsawHour(y, m - 1, d, h), pln_per_kwh: byHour[h] ?? 0 })
    }
    return out
  }

  return out
}

/** ====== REQUEST HANDLER ====== */
function withTimeout<T>(p: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) }
    )
  })
}

export async function GET(req: NextRequest) {
  const { y, m, d } = parseDate(req)
  const fromISO = isoForWarsawHour(y, m - 1, d, 0)
  const toISO = isoForWarsawHour(y, m - 1, d + 1, 0)

  const errors: Record<string, string> = {}

  const [foxRes, rceRes] = await Promise.allSettled([
    withTimeout(foxessDay(y, m, d), 9000, 'FoxESS'),
    withTimeout(rceDay(y, m, d), 9000, 'RCE'),
  ])

  let fox: Array<{ timestamp: string; exported_kwh: number }> = []
  let rce: Array<{ timestamp: string; pln_per_kwh: number }> = []
  if (foxRes.status === 'fulfilled') fox = foxRes.value as any
  else errors.foxess = foxRes.reason?.message || String(foxRes.reason)

  if (rceRes.status === 'fulfilled') rce = rceRes.value as any
  else errors.rce = rceRes.reason?.message || String(rceRes.reason)

  // Merge po timestamp
  const map = new Map<string, { timestamp: string; exported_kwh: number; rce_pln_per_kwh?: number; revenue_pln?: number }>()
  for (const p of fox) map.set(p.timestamp, { timestamp: p.timestamp, exported_kwh: Number(p.exported_kwh) || 0 })
  for (const p of rce) {
    const row = map.get(p.timestamp) || { timestamp: p.timestamp, exported_kwh: 0 }
    row.rce_pln_per_kwh = Number(p.pln_per_kwh) || 0
    row.revenue_pln = Number(((row.exported_kwh || 0) * (row.rce_pln_per_kwh || 0)).toFixed(6))
    map.set(p.timestamp, row)
  }

  const hourly = Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const totals = hourly.reduce(
    (acc, r) => {
      acc.exported_kwh += r.exported_kwh || 0
      acc.revenue_pln += r.revenue_pln || 0
      return acc
    },
    { exported_kwh: 0, revenue_pln: 0 }
  )

  return new Response(
    JSON.stringify(
      {
        ok: true,
        range: { fromISO, toISO },
        hourly,
        totals: {
          exported_kwh: Number(totals.exported_kwh.toFixed(6)),
          revenue_pln: Number(totals.revenue_pln.toFixed(6)),
        },
        errors: Object.keys(errors).length ? errors : undefined,
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
  )
}
