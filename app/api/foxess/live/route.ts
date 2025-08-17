// app/api/foxess/live/route.ts
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// cache 60 s
type FoxVar = { variable?: string; value?: any; unit?: string; name?: string }
type LivePayload =
  | { ok: true; pv_w: number; feedin_w: number; dbg?: any }
  | { ok: false; error: string; dbg?: any }

const LIVE_TTL_MS = 60_000
const g = globalThis as any
g.__fox_live ||= { ts: 0, payload: null as LivePayload | null }

/** FoxESS podpis: path + "\\r\\n" + token + "\\r\\n" + timestamp (LITERALNE backslashe) */
function foxHeaders(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const JOIN = '\\r\\n'
  const toSign = `${path}${JOIN}${token}${JOIN}${ts}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    token,
    timestamp: ts,
    signature,
    lang: 'en',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  }
}

async function realQuery(base: string, token: string, sn: string, vars?: ReadonlyArray<string>) {
  const path = '/op/v0/device/real/query'
  const url = new URL(path, base)
  const body = vars && vars.length ? { sn, variables: Array.from(vars) } : { sn }
  const res = await fetch(url.toString(), { method: 'POST', headers: foxHeaders(path, token), body: JSON.stringify(body) })
  const text = await res.text()
  let json: any; try { json = JSON.parse(text) } catch { json = null }
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (json && typeof json.errno === 'number' && json.errno !== 0) throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'error'}`)

  // ——— FLATTEN ———
  // Dostajesz: { result: [{ datas: [{variable,value,unit}, ...], time, deviceSN }] }
  const r = json?.result
  if (Array.isArray(r) && r.length && Array.isArray(r[0]?.datas)) {
    return (r as Array<{ datas: FoxVar[] }>).flatMap(x => x.datas)
  }
  if (r && Array.isArray(r?.datas)) return (r.datas as FoxVar[])
  return Array.isArray(r) ? (r as FoxVar[]) : []
}

// aliasy z Twojego dumpa
const NAMES = {
  pv: [
    'pvpower', 'pvPower',
    'generationpower', 'generationPower',
    'inverterpower', 'acpower', 'ppv', 'pv_total_power'
  ] as const,
  pvRegex: [/^pv\d+power$/i, /^pv\d+_?powerw?$/i] as const,
  feed: ['feedinpower', 'feedinPower', 'exportpower'] as const,
  grid: ['gridpower', 'gridactivepower', 'grid_export_power', 'gridimportpower', 'gridexportpower'] as const,
} as const

const toNumber = (v: any) => {
  if (typeof v === 'string') {
    const s = v.replace(/[^\d.\-]/g, '')
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const readValueW = (x?: FoxVar) => {
  if (!x) return 0
  let val = toNumber(x.value)
  const unit = String(x.unit || '').toLowerCase()
  if (unit === 'kw') val *= 1000 // kW → W
  return val
}
function pick(arr: ReadonlyArray<FoxVar>, names: ReadonlyArray<string>) {
  const lower = names.map(n => n.toLowerCase())
  const hit = arr.find(x => lower.includes(String(x?.variable || '').toLowerCase()))
  return readValueW(hit)
}
function pickByRegex(arr: ReadonlyArray<FoxVar>, regs: ReadonlyArray<RegExp>, agg: 'sum' | 'max' = 'sum') {
  const vals: number[] = []
  for (const r of regs) {
    for (const x of arr) {
      if (r.test(String(x?.variable || ''))) vals.push(readValueW(x))
    }
  }
  if (!vals.length) return 0
  return agg === 'sum' ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wantDebug = url.searchParams.get('debug') === '1'

  if (!wantDebug && g.__fox_live.payload && Date.now() - g.__fox_live.ts < LIVE_TTL_MS) {
    return new Response(JSON.stringify(g.__fox_live.payload, null, 2), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
    })
  }

  try {
    const base = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
    const token = (process.env.FOXESS_API_TOKEN || '').trim()
    const sn = (process.env.FOXESS_DEVICE_SN || '').trim()
    if (!token || !sn) {
      const payload: LivePayload = { ok: false, error: 'Brak FOXESS_API_TOKEN lub FOXESS_DEVICE_SN' }
      if (!wantDebug) g.__fox_live = { ts: Date.now(), payload }
      return new Response(JSON.stringify(payload, null, 2), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // najpierw szeroka lista, potem fallback „bez listy”
    const first: string[] = [
      ...NAMES.pv,
      'pv1Power','pv2Power','pv3Power','pv4Power', // z Twojego dumpa
      ...NAMES.feed, ...NAMES.grid, 'loadsPower','batPower'
    ]
    let vars = await realQuery(base, token, sn, first)
    if (!vars.length) vars = await realQuery(base, token, sn)

    // heurystyki PV i feed-in
    const pvCand = [
      pick(vars, NAMES.pv),
      pickByRegex(vars, NAMES.pvRegex, 'sum'),
    ].filter(v => v > 0)
    const pv_w = pvCand.length ? pvCand[0] : 0

    const feedRaw = pick(vars, NAMES.feed)
    const grid = pick(vars, NAMES.grid)
    const feedin_w = feedRaw > 0 ? feedRaw : (grid < 0 ? -grid : 0)

    const payload: LivePayload = { ok: true, pv_w, feedin_w, dbg: wantDebug ? { sample: [{ datas: vars.slice(0, 40) }] } : undefined }
    if (!wantDebug) g.__fox_live = { ts: Date.now(), payload }
    return new Response(JSON.stringify(payload, null, 2), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    const payload: LivePayload = { ok: false, error: e?.message || 'live error' }
    if (!wantDebug) g.__fox_live = { ts: Date.now(), payload }
    return new Response(JSON.stringify(payload, null, 2), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
