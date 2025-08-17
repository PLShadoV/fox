// app/api/foxess/debug/route.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function headersFor(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const ts = Date.now().toString()
  const JOIN = '\\r\\n'
  const toSign = `${path}${JOIN}${token}${JOIN}${ts}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'lang': 'en',
    'token': token, 'timestamp': ts, 'signature': signature
  } as Record<string,string>
}

export async function GET(_req: NextRequest) {
  const base = (process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com').trim()
  const token = (process.env.FOXESS_API_TOKEN || '').trim()
  const sn = (process.env.FOXESS_DEVICE_SN || '').trim()
  const variable = (process.env.FOXESS_VARIABLE || 'feedin').toLowerCase()

  const detailPath = '/op/v0/device/detail'
  const reportPath = '/op/v0/device/report/query'

  const detailUrl = new URL(detailPath, base); if (sn) detailUrl.searchParams.set('sn', sn)
  const now = new Date()
  const body = { sn, year: now.getUTCFullYear(), month: now.getUTCMonth()+1, day: now.getUTCDate(), dimension: 'day', variables: [variable] }

  const d = await fetch(detailUrl.toString(), { method:'GET', headers: headersFor(detailPath, token) })
  const r = await fetch(new URL(reportPath, base).toString(), { method:'POST', headers: headersFor(reportPath, token), body: JSON.stringify(body) })

  const dTxt = await d.text(), rTxt = await r.text()
  let dJson:any=null, rJson:any=null
  try { dJson = JSON.parse(dTxt) } catch { dJson = { raw: dTxt.slice(0,200) } }
  try { rJson = JSON.parse(rTxt) } catch { rJson = { raw: rTxt.slice(0,200) } }

  return new Response(JSON.stringify({
    env: { base, hasToken: !!token, sn, variable },
    detail: { status: d.status, ct: d.headers.get('content-type') || '', ...('errno' in (dJson||{}) ? dJson : { body:dJson }) },
    report: { status: r.status, ct: r.headers.get('content-type') || '', ...('errno' in (rJson||{}) ? rJson : { body:rJson }) },
  }, null, 2), { headers: { 'content-type': 'application/json' } })
}
