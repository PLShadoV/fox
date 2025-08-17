// app/api/foxess/live/route.ts
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// prościutki cache w pamięci (TTL = 60s)
type LivePayload = { ok: true; pv_w: number; feedin_w: number } | { ok: false; error: string }
const LIVE_TTL_MS = 60_000
const g = globalThis as any
g.__fox_live ||= { ts: 0, payload: null as LivePayload | null }

function foxHeaders(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const JOIN = '\\r\\n' // LITERAL \r\n — to jest kluczowe dla FoxESS Cloud
  const toSign = `${path}${JOIN}${token}${JOIN}${ts}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    token,
    timestamp: ts,
    signature,
    lang: 'en',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  }
}

async function realQuery(base: string, token: string, sn: string, vars?: string[]) {
  const path = '/op/v0/device/real/query'
  const url = new URL(path, base)
  const body = vars && vars.length ? { sn, variables: vars } : { sn }
  const res = await fetch(url.toString(), { method: 'POST', headers: foxHeaders(path, token), body: JSON.stringify(body) })
  const text = await res.text()
  let json: any; try { json = JSON.parse(text) } catch { json = null }
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (json && typeof json.errno === 'number' && json.errno !== 0) throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'error'}`)
  return Array.isArray(json?.result) ? json.result as Array<{ variable: string; value: any }> : []
}

function pickNumber(arr: Array<{ variable: string; value: any }>, name: string) {
  const item = arr.find(x => String(x?.variable || '').toLowerCase() === name)
  const v = Number(item?.value ?? 0)
  return isFinite(v) ? v : 0
}

export async function GET(_req: NextRequest) {
  // cache 60s
  if (g.__fox_live.payload && Date.now() - g.__fox_live.ts < LIVE_TTL_MS) {
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
      g.__fox_live = { ts: Date.now(), payload }
      return new Response(JSON.stringify(payload, null, 2), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // 1️⃣ najpierw prosimy o szeroki zestaw zmiennych
    const primaryVars = [
      'pvpower', 'generationpower', 'inverterpower',
      'pv1power', 'pv2power', 'pv3power', 'pv4power',
      'gridpower', 'feedinpower', 'loadsPower', 'batpower'
    ]
    let result = await realQuery(base, token, sn, primaryVars)

    // 2️⃣ jeśli pusto — spróbuj bez listy (niektóre konta tylko tak zwracają)
    if (!result.length) {
      result = await realQuery(base, token, sn, undefined)
    }

    // Heurystyka:
    // PV = generationpower || pvpower || sum(pvXpower) || inverterpower (jeśli >0)
    // FEED-IN = feedinpower || (gridpower < 0 ? -gridpower : 0)
    const gen = pickNumber(result, 'generationpower')
    const pv = pickNumber(result, 'pvpower')
    const inv = pickNumber(result, 'inverterpower')
    const pvSum =
      pickNumber(result, 'pv1power') + pickNumber(result, 'pv2power') +
      pickNumber(result, 'pv3power') + pickNumber(result, 'pv4power')
    const grid = pickNumber(result, 'gridpower')
    const feedin = pickNumber(result, 'feedinpower')

    const pv_w = [gen, pv, pvSum, inv].find(v => v > 0) ?? 0
    const feedin_w = feedin > 0 ? feedin : (grid < 0 ? -grid : 0)

    const payload: LivePayload = { ok: true, pv_w, feedin_w }
    g.__fox_live = { ts: Date.now(), payload }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60, stale-while-revalidate=30' },
    })
  } catch (e: any) {
    const payload: LivePayload = { ok: false, error: e?.message || 'live error' }
    g.__fox_live = { ts: Date.now(), payload }
    return new Response(JSON.stringify(payload, null, 2), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
