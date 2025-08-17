// app/api/foxess/debug/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function signatureHeaders(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const timestamp = Date.now().toString()
  const JOIN = '\\r\\n' // literalne \r\n
  const toSign = `${path}${JOIN}${token}${JOIN}${timestamp}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    lang: 'en',
    token,
    timestamp,
    signature,
  } as Record<string, string>
}

async function callGet(url: URL, pathForSignature: string, token: string) {
  const headers = signatureHeaders(pathForSignature, token)
  const res = await fetch(url.toString(), { headers, method: 'GET' })
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''
  let body: any
  try { body = JSON.parse(text) } catch { body = text.slice(0, 400) }
  return {
    status: res.status,
    ct,
    errno: typeof body?.errno === 'number' ? body.errno : undefined,
    msg: body?.msg,
    preview: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200),
  }
}

async function callPost(url: URL, pathForSignature: string, token: string, json: any) {
  const headers = signatureHeaders(pathForSignature, token)
  const res = await fetch(url.toString(), { headers, method: 'POST', body: JSON.stringify(json) })
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''
  let body: any
  try { body = JSON.parse(text) } catch { body = text.slice(0, 400) }
  return {
    status: res.status,
    ct,
    errno: typeof body?.errno === 'number' ? body.errno : undefined,
    msg: body?.msg,
    preview: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200),
  }
}

export async function GET(_req: NextRequest) {
  const base = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
  const token = (process.env.FOXESS_API_TOKEN || '').trim()
  const sn = (process.env.FOXESS_DEVICE_SN || '').trim()
  const variable = (process.env.FOXESS_VARIABLE || 'feedin').toLowerCase()

  const detailPath = '/op/v0/device/detail'
  const reportPath = '/op/v0/device/report/query'

  const detailUrl = new URL(detailPath, base)
  if (sn) detailUrl.searchParams.set('sn', sn)

  const reportUrl = new URL(reportPath, base)
  const today = new Date()
  const body = { sn, year: today.getUTCFullYear(), month: today.getUTCMonth() + 1, day: today.getUTCDate(), dimension: 'day', variables: [variable] }

  const detail = await callGet(detailUrl, detailPath, token)
  const report = await callPost(reportUrl, reportPath, token, body)

  const maskedToken = token ? `${token.slice(0, 4)}...${token.slice(-4)} (${token.length} chars)` : ''

  return new Response(JSON.stringify({ env: { base, hasToken: !!token, sn, variable }, tokenPreview: maskedToken, detail, report }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
