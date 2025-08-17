// app/api/data/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion: string[] = ['waw1', 'fra1', 'arn1']

// --- KONFIG ---
const TZ = 'Europe/Warsaw'
const FOX_TIMEOUT_MS = 8000
const RCE_TIMEOUT_MS = 8000
const FOX_BASE = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
const FOX_TOKEN = (process.env.FOXESS_API_TOKEN || '').trim()
const FOX_SN = (process.env.FOXESS_DEVICE_SN || '').trim()
const FOX_VAR = (process.env.FOXESS_VARIABLE || 'feedin').toLowerCase() // np. 'feedin' lub 'generation'
const RCE_API = 'https://api.raporty.pse.pl/api/rce-pln'

// --- POMOCNICZE ---
type HourRow = { timestamp: string; exported_kwh: number; rce_pln_per_kwh?: number; revenue_pln?: number }

function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(seed)
  const Y = Number(parts.find(p => p.type === 'year')!.value)
  const M = Number(parts.find(p => p.type === 'month')!.value)
  const D = Number(parts.find(p => p.type === 'day')!.value)
  const H = Number(parts.find(p => p.type === 'hour')!.value)
  return new Date(Date.UTC(Y, M - 1, D, H, 0, 0)).toISOString()
}
function ymdPL(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
  const Y = parts.find(p => p.type === 'year')!.value
  const M = parts.find(p => p.type === 'month')!.value
  const D = parts.find(p => p.type === 'day')!.value
  return `${Y}-${M}-${D}`
}
function parseRange(req: NextRequest): { dayY: number; dayM: number; dayD: number; fromISO: string; toISO: string; info: string } {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('date') || searchParams.get('day') || searchParams.get('d')
  const range = (searchParams.get('range') || '').toLowerCase() // 'today' | 'yesterday'
  let base = new Date()
  if (!q && range !== 'today') {
    // domyślnie wczoraj w strefie PL
    const nowParts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date())
    const Y = Number(nowParts.find(p=>p.type==='year')!.value)
    const M = Number(nowParts.find(p=>p.type==='month')!.value)
    const D = Number(nowParts.find(p=>p.type==='day')!.value)
    const mid = new Date(Date.UTC(Y, M-1, D, 12)); mid.setUTCDate(mid.getUTCDate()-1)
    base = mid
  }
  if (q) {
    const [y,m,d] = q.split('-').map(Number)
    const fromISO = isoForWarsawHour(y, (m||1)-1, d||1, 0)
    const toISO   = isoForWarsawHour(y, (m||1)-1, (d||1)+1, 0)
    return { dayY:y, dayM:m||1, dayD:d||1, fromISO, toISO, info:`date=${q}` }
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(base)
  const y = Number(parts.find(p=>p.type==='year')!.value)
  const m = Number(parts.find(p=>p.type==='month')!.value)
  const d = Number(parts.find(p=>p.type==='day')!.value)
  const fromISO = isoForWarsawHour(y, m-1, d, 0)
  const toISO   = isoForWarsawHour(y, m-1, d+1, 0)
  return { dayY:y, dayM:m, dayD:d, fromISO, toISO, info: range || 'yesterday(default)' }
}
function foxHeaders(path: string, token: string) {
  // LITERALNE "\r\n" (backslash-r backslash-n), to jest kluczowe
  const JOIN = '\\r\\n'
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
  } as Record<string,string>
}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(()=>ctrl.abort(), ms)
  // @ts-ignore
  if (typeof (p as any)?.then !== 'function') return Promise.reject(new Error(`${label} not a promise`))
  return new Promise((resolve,reject) => {
    p.then((v:any)=>{ clearTimeout(t); resolve(v) }, (e:any)=>{ clearTimeout(t); reject(e) })
  })
}

// --- POBRANIA ---
async function fetchFoxessDay(y: number, m: number, d: number) {
  if (!FOX_TOKEN) throw new Error('Brak FOXESS_API_TOKEN')
  if (!FOX_SN)    throw new Error('Brak FOXESS_DEVICE_SN')
  const path = '/op/v0/device/report/query'
  const url  = new URL(path, FOX_BASE)
  const body = { sn: FOX_SN, year: y, month: m, day: d, dimension: 'day', variables: [FOX_VAR] }
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, FOX_TOKEN),
    body: JSON.stringify(body),
    // @ts-ignore
    cache: 'no-store'
  })
  const ct = res.headers.get('content-type') || ''
  const txt = await res.text()
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${txt.slice(0,200)}`)
  if (!ct.includes('application/json')) throw new Error(`FoxESS content-type ${ct || 'brak'} — ${txt.slice(0,120)}`)
  const json = JSON.parse(txt)
  if (typeof json?.errno === 'number' && json.errno !== 0) throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'API error'}`)
  const series = (json?.result || []).find((v:any)=>String(v?.variable||'').toLowerCase()===FOX_VAR)?.values ?? []
  const out: Array<{timestamp:string; exported_kwh:number}> = []
  for (let h=0; h<24; h++) {
    const val = Number(series[h] ?? 0)
    out.push({ timestamp: isoForWarsawHour(y, m-1, d, h), exported_kwh: isFinite(val) ? val : 0 })
  }
  return out
}

async function fetchRceDay(y: number, m: number, d: number) {
  const doba = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const url = new URL(RCE_API)
  url.searchParams.set('$filter', `doba eq '${doba}'`)
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } as any })
  const txt = await res.text()
  if (!res.ok) throw new Error(`PSE RCE HTTP ${res.status} — ${txt.slice(0,200)}`)
  const json = JSON.parse(txt)

  // mapowanie 1: value[0].rce_pln => tablica 24 wartości
  if (Array.isArray(json?.value) && json.value.length && Array.isArray(json.value[0]?.rce_pln)) {
    const arr = json.value[0].rce_pln
    const rows: Array<{timestamp:string; pln_per_kwh:number}> = []
    for (let h=0; h<24; h++) {
      const plnMWh = Number(arr[h] ?? 0)
      rows.push({ timestamp: isoForWarsawHour(y, m-1, d, h), pln_per_kwh: isFinite(plnMWh) ? plnMWh/1000 : 0 })
    }
    return rows
  }

  // mapowanie 2: tablica rekordów godzinowych z polem oreb/period/hour i rce_pln
  if (Array.isArray(json?.value) && json.value.length) {
    const byHour: Record<number, number> = {}
    for (const r of json.value) {
      const idx = Number(r.oreb ?? r.period ?? r.hour ?? 0) // 1..24
      const plnMWh = Number(r.rce_pln ?? r.RCE ?? 0)
      if (idx>=1 && idx<=24 && isFinite(plnMWh)) byHour[idx-1] = plnMWh/1000
    }
    const rows: Array<{timestamp:string; pln_per_kwh:number}> = []
    for (let h=0; h<24; h++) rows.push({ timestamp: isoForWarsawHour(y, m-1, d, h), pln_per_kwh: byHour[h] ?? 0 })
    return rows
  }

  throw new Error('Nieznany format odpowiedzi PSE /rce-pln')
}

// --- HANDLER ---
export async function GET(req: NextRequest) {
  const { dayY, dayM, dayD, fromISO, toISO, info } = parseRange(req)
  const errors: Record<string,string> = {}

  const foxP = withTimeout(fetchFoxessDay(dayY, dayM, dayD), FOX_TIMEOUT_MS, 'FoxESS')
  const rceP = withTimeout(fetchRceDay(dayY, dayM, dayD),     RCE_TIMEOUT_MS, 'RCE')

  const [foxRes, rceRes] = await Promise.allSettled([foxP, rceP])

  let fox: Array<{timestamp:string; exported_kwh:number}> = []
  let rce: Array<{timestamp:string; pln_per_kwh:number}> = []
  if (foxRes.status === 'fulfilled') fox = foxRes.value
  else errors.foxess = foxRes.reason?.message || String(foxRes.reason)
  if (rceRes.status === 'fulfilled') rce = rceRes.value
  else errors.rce = rceRes.reason?.message || String(rceRes.reason)

  // merge
  const map = new Map<string, HourRow>()
  for (const p of fox) map.set(p.timestamp, { timestamp: p.timestamp, exported_kwh: Number(p.exported_kwh)||0 })
  for (const p of rce) {
    const row = map.get(p.timestamp) || { timestamp: p.timestamp, exported_kwh: 0 }
    row.rce_pln_per_kwh = Number(p.pln_per_kwh)||0
    row.revenue_pln = Number(((row.exported_kwh||0) * (row.rce_pln_per_kwh||0)).toFixed(6))
    map.set(p.timestamp, row)
  }
  const hourly = Array.from(map.values()).sort((a,b)=>a.timestamp.localeCompare(b.timestamp))
  const totals = hourly.reduce((acc,r)=>{ acc.exported_kwh += r.exported_kwh||0; acc.revenue_pln += r.revenue_pln||0; return acc }, { exported_kwh:0, revenue_pln:0 })

  return new Response(JSON.stringify({
    ok: true,
    parsedBy: info,
    range: { fromISO, toISO },
    hourly,
    totals: {
      exported_kwh: Number(totals.exported_kwh.toFixed(6)),
      revenue_pln:  Number(totals.revenue_pln.toFixed(6))
    },
    errors: Object.keys(errors).length ? errors : undefined
  }, null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  })
}
