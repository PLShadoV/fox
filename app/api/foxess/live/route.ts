// app/api/foxess/live/route.ts
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// cache 60 s (ograniczenie zapytań)
type FoxVar = { variable?: string; value?: any; unit?: string }
type LivePayload =
  | { ok: true; pv_w: number; feedin_w: number; dbg?: any }
  | { ok: false; error: string; dbg?: any }

const LIVE_TTL_MS = 60_000
const g = globalThis as any
g.__fox_live ||= { ts: 0, payload: null as LivePayload | null }

function foxHeaders(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const JOIN = '\\r\\n' // LITERALNE \r\n – tego wymaga FoxESS Cloud
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
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, token),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = null }
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (json && typeof json.errno === 'number' && json.errno !== 0) {
    throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'error'}`)
  }
  return Array.isArray(json?.result) ? (json.result as FoxVar[]) : []
}

const NAMES = {
  pv: [
    'pvpower', 'generationpower', 'inverterpower', 'acpower',
    'ppv', 'pv_total_power',
  ] as const,
  pvRegex: [/^pv\d+power$/i, /^pv\d+_?powerw?$/i] as const,
  feed: ['feedinpower', 'exportpower'] as const,
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

function pick(arr: ReadonlyArray<FoxVar>, names: ReadonlyArray<string>) {
  const lower = names.map((n) => n.toLowerCase())
  const hit = arr.find((x) => lower.includes(String(x?.variable || '').toLowerCase()))
  return toNumber(hit?.value)
}

function pickByRegex(
  arr: ReadonlyArray<FoxVar>,
  regs: ReadonlyArray<RegExp>,
  agg: 'sum' | 'max' = 'sum'
) {
  const vals: number[] = []
  for (const r of regs) {
    for (const x of arr) {
      if (r.test(String(x?.variable || ''))) vals.push(toNumber(x.value))
    }
  }
  if (!vals.length) return 0
  return agg === 'sum' ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wantDebug = url.searchParams.get('debug') === '1'

  // pamięciowy cache (nie dotyczy trybu debug)
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

    // szeroki zestaw zmiennych (tworzę zwykłe string[])
    const first: string[] = [
      ...NAMES.pv,
      'pv1power', 'pv2power', 'pv3power', 'pv4power',
      ...NAMES.feed, ...NAMES.grid,
      'loadspower', 'batpower'
    ]
    let vars = await realQuery(base, token, sn, first)

    // fallback – bez listy
    if (!vars.length) vars = await realQuery(base, token, sn)

    // heurystyki
    const pvCand = [
      pick(vars, NAMES.pv),
      pickByRegex(vars, NAMES.pvRegex, 'sum'),
    ].filter((v) => v > 0)
    const pv_w = pvCand.length ? pvCand[0] : 0

    const feedRaw = pick(vars, NAMES.feed)
    const grid = pick(vars, NAMES.grid)
    const feedin_w = feedRaw > 0 ? feedRaw : grid < 0 ? -grid : 0

    const payload: LivePayload = { ok: true, pv_w, feedin_w, dbg: wantDebug ? { sample: vars.slice(0, 30) } : undefined }
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
