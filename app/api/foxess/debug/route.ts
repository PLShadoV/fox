// app/api/foxess/debug/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SigVariant = 'LITERAL_CRLF' | 'REAL_CRLF' | 'LF' | 'LITERAL_CRLF+UPPER' | 'NO_LEADING_SLASH'

function makeSig(path: string, tokenRaw: string, variant: SigVariant) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const join =
    variant === 'LF' ? '\n'
    : variant === 'REAL_CRLF' ? '\r\n'
    : '\\r\\n' // ← domyślnie LITERALNE \r\n

  const p = variant === 'NO_LEADING_SLASH' && path.startsWith('/') ? path.slice(1) : path
  const toSign = `${p}${join}${token}${join}${ts}`
  let sig = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  if (variant === 'LITERAL_CRLF+UPPER') sig = sig.toUpperCase()
  return { ts, sig, toSign }
}

async function call(url: URL, pathForSignature: string, token: string, variant: SigVariant, method: 'GET' | 'POST', body?: any) {
  const { ts, sig } = makeSig(pathForSignature, token, variant)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'lang': 'en',
    'token': token.trim(),
    'timestamp': ts,
    'signature': sig,
  }
  const res = await fetch(url.toString(), { headers, method, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let parsed: any
  try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 400) }
  return {
    variant,
    status: res.status,
    ct: res.headers.get('content-type') || '',
    errno: typeof parsed?.errno === 'number' ? parsed.errno : undefined,
    msg: parsed?.msg,
    preview: typeof parsed === 'string' ? parsed : JSON.stringify(parsed).slice(0, 200),
  }
}

export async function GET(req: NextRequest) {
  const base = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
  const token = (process.env.FOXESS_API_TOKEN || '').trim()
  const sn = (process.env.FOXESS_DEVICE_SN || '').trim()

  const detailPath = '/op/v0/device/detail'
  const reportPath = '/op/v0/device/report/query'

  const detailUrl = new URL(detailPath, base)
  if (sn) detailUrl.searchParams.set('sn', sn)

  const reportUrl = new URL(reportPath, base)
  const today = new Date()
  const body = { sn, year: today.getUTCFullYear(), month: today.getUTCMonth() + 1, day: today.getUTCDate(), dimension: 'day', variables: ['feedin'] }

  const variants: SigVariant[] = ['LITERAL_CRLF', 'REAL_CRLF', 'LF', 'LITERAL_CRLF+UPPER', 'NO_LEADING_SLASH']

  const detail = await Promise.all(variants.map(v => call(detailUrl, detailPath, token, v, 'GET')))
  const report = await Promise.all(variants.map(v => call(reportUrl, reportPath, token, v, 'POST', body)))

  const maskedToken = token ? `${token.slice(0, 4)}...${token.slice(-4)} (${token.length} chars)` : ''
  return new Response(JSON.stringify({ env: { base, hasToken: !!token, sn }, tokenPreview: maskedToken, detail, report }, null, 2), {
    headers: { 'content-type': 'application/json' }
  })
}
