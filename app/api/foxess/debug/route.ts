// app/api/foxess/debug/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SigVariant = 'CRLF+lower' | 'LF+lower' | 'CRLF+UPPER' | 'CRLF+lower+QUERY'

function makeSig(path: string, tokenRaw: string, variant: SigVariant) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const join = variant.includes('LF') && !variant.includes('CRLF') ? '\n' : '\r\n'
  const pathToUse = variant.endsWith('+QUERY') ? path : path
  const toSign = `${pathToUse}${join}${token}${join}${ts}`
  let sig = crypto.createHash('md5').update(toSign).digest('hex')
  if (variant.includes('UPPER')) sig = sig.toUpperCase()
  return { ts, sig, toSign }
}

async function call(url: URL, pathForSignature: string, token: string, variant: SigVariant) {
  const { ts, sig } = makeSig(pathForSignature, token, variant)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'lang': 'en',
    'token': token.trim(),
    'timestamp': ts,
    'sign': sig, // ← kluczowe: "sign"
  }
  const res = await fetch(url.toString(), { headers, method: 'GET' })
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 400)
  }
  return {
    name: variant,
    status: res.status,
    ct: res.headers.get('content-type') || '',
    errno: typeof body?.errno === 'number' ? body.errno : undefined,
    msg: body?.msg,
    preview: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200),
  }
}

async function post(url: URL, pathForSignature: string, token: string, variant: SigVariant, json: any) {
  const { ts, sig } = makeSig(pathForSignature, token, variant)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'lang': 'en',
    'token': token.trim(),
    'timestamp': ts,
    'sign': sig, // ← kluczowe: "sign"
  }
  const res = await fetch(url.toString(), { headers, method: 'POST', body: JSON.stringify(json) })
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 400)
  }
  return {
    name: variant,
    status: res.status,
    ct: res.headers.get('content-type') || '',
    errno: typeof body?.errno === 'number' ? body.errno : undefined,
    msg: body?.msg,
    preview: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200),
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
  const body = {
    sn,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
    day: today.getUTCDate(),
    dimension: 'day',
    variables: ['feedin'],
  }

  const variants: SigVariant[] = ['CRLF+lower', 'LF+lower', 'CRLF+UPPER', 'CRLF+lower+QUERY']

  const detailResults = await Promise.all(
    variants.map((v) => {
      const signPath = v.endsWith('+QUERY') ? `${detailPath}?sn=${encodeURIComponent(sn)}` : detailPath
      return call(detailUrl, signPath, token, v)
    })
  )

  const reportResults = await Promise.all(
    variants.map((v) => {
      const signPath = reportPath
      return post(reportUrl, signPath, token, v, body)
    })
  )

  const maskedToken = token ? `${token.slice(0, 4)}...${token.slice(-4)} (${token.length} chars)` : ''

  return new Response(
    JSON.stringify(
      {
        env: { base, hasToken: !!token, sn },
        tokenPreview: maskedToken,
        ua: 'Mozilla/5.0 ... Chrome/117 Safari/537.36',
        detail: detailResults,
        report: reportResults,
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json' } }
  )
}
