// app/api/foxess/live/route.ts
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Podpis MD5: path + "\\r\\n" + token + "\\r\\n" + timestamp (LITERALNE backslashe) */
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

export async function GET(_req: NextRequest) {
  try {
    const base = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
    const token = (process.env.FOXESS_API_TOKEN || '').trim()
    const sn = (process.env.FOXESS_DEVICE_SN || '').trim()
    if (!token || !sn) {
      return new Response(JSON.stringify({ ok: false, error: 'Brak FOXESS_API_TOKEN lub FOXESS_DEVICE_SN' }), { status: 400 })
    }

    const path = '/op/v0/device/real/query'
    const url = new URL(path, base)
    // Najczęściej działające zmienne (nazwy są case-insensitive po stronie FoxESS)
    const body = {
      sn,
      variables: ['pvpower', 'feedinpower'],
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: foxHeaders(path, token),
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let json: any
    try { json = JSON.parse(text) } catch { /* fallback */ }

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `FoxESS HTTP ${res.status}`, raw: text.slice(0, 200) }), { status: 502 })
    }
    if (json && typeof json.errno === 'number' && json.errno !== 0) {
      return new Response(JSON.stringify({ ok: false, error: `FoxESS errno ${json.errno}: ${json?.msg || 'error'}` }), { status: 502 })
    }

    // Oczekiwany kształt: { result: [{ variable: 'pvpower', value: 1234 }, ... ] }
    const arr = Array.isArray(json?.result) ? json.result : []
    const v = (name: string) =>
      Number(arr.find((x: any) => String(x?.variable || '').toLowerCase() === name)?.value ?? 0)

    const pv_w = v('pvpower')
    const feedin_w = v('feedinpower')

    return new Response(JSON.stringify({ ok: true, pv_w, feedin_w }, null, 2), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'live error' }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
