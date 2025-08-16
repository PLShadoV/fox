
// app/api/foxess/debug/route.ts
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const base = process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com'
  const token = process.env.FOXESS_API_TOKEN || ''
  const sn = process.env.FOXESS_DEVICE_SN || ''

  const headers = (path: string) => {
    const crypto = await import('crypto')
    const timestamp = Date.now().toString()
    const signature = crypto.createHash('md5').update(`${path}\r\n${token}\r\n${timestamp}`).digest('hex')
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

  async function call(path: string, init?: RequestInit) {
    const res = await fetch(new URL(path, base).toString(), init)
    const text = await res.text()
    const ct = res.headers.get('content-type') || ''
    return { ok: res.ok, status: res.status, ct, text, url: res.url }
  }

  const detail = await call('/op/v0/device/detail' + (sn ? `?sn=${encodeURIComponent(sn)}` : ''))
  const day = new Date().toISOString().slice(0,10).split('-').map(Number) // UTC date today
  const body = JSON.stringify({ sn, year: day[0], month: day[1], day: day[2], dimension: 'day', variables: ['feedin'] })

  const report = await call('/op/v0/device/report/query', { method: 'POST', headers: headers('/op/v0/device/report/query'), body })

  return Response.json({ env: { base, hasToken: !!token, sn }, detail, report })
}
