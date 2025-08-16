// app/api/foxess/debug/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sign(path: string, token: string) {
  const timestamp = Date.now().toString()
  const signature = crypto.createHash('md5').update(`${path}\r\n${token}\r\n${timestamp}`).digest('hex')
  return { timestamp, signature }
}

function foxHeaders(path: string, token: string) {
  const { timestamp, signature } = sign(path, token)
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'token': token,
    'timestamp': timestamp,
    'signature': signature,
    'lang': 'en',
    'User-Agent': 'foxess-rce-dashboard/1.0'
  }
}

async function call(base: string, path: string, init?: RequestInit) {
  const res = await fetch(new URL(path, base).toString(), init)
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''
  return { ok: res.ok, status: res.status, ct, text: text.slice(0, 500), url: res.url }
}

export async function GET(req: NextRequest) {
  const base = process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com'
  const token = process.env.FOXESS_API_TOKEN || ''
  const sn = process.env.FOXESS_DEVICE_SN || ''

  const detailPath = '/op/v0/device/detail'
  const reportPath = '/op/v0/device/report/query'

  const detailUrl = sn ? `${detailPath}?sn=${encodeURIComponent(sn)}` : detailPath
  const detail = await call(base, detailUrl, { headers: foxHeaders(detailPath, token) })

  const today = new Date()
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() + 1
  const d = today.getUTCDate()
  const body = JSON.stringify({ sn, year: y, month: m, day: d, dimension: 'day', variables: ['feedin'] })

  const report = await call(base, reportPath, {
    method: 'POST',
    headers: foxHeaders(reportPath, token),
    body
  })

  return new Response(JSON.stringify({ env: { base, hasToken: !!token, sn }, detail, report }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
