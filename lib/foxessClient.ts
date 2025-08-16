// lib/foxessClient.ts
import crypto from 'crypto'

export type FoxessMethod = 'GET' | 'POST'
export interface FoxessOptions {
  base?: string
  token?: string
  path: string                 // np. '/op/v0/device/report/query'
  method?: FoxessMethod
  body?: any                   // obiekt – zserializujemy do JSON
}

const DEFAULT_BASE = 'https://www.foxesscloud.com'

function headersWithSignature(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const timestamp = Date.now().toString()
  const JOIN = '\\r\\n'                         // ← literalne \r\n
  const toSign = `${path}${JOIN}${token}${JOIN}${timestamp}`
  const signature = crypto.createHash('md5').update(toSign, 'utf8').digest('hex')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    token,
    timestamp,
    signature,
    lang: 'en',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  } as Record<string, string>
}

export async function foxessRequest<T = any>(opts: FoxessOptions): Promise<T> {
  const base = (opts.base || process.env.FOXESS_API_BASE || DEFAULT_BASE).trim()
  const token = (opts.token || process.env.FOXESS_API_TOKEN || '').trim()
  const path = opts.path
  if (!token) throw new Error('Brak FOXESS_API_TOKEN')
  const url = new URL(path, base)
  const method = (opts.method || 'POST') as FoxessMethod
  const headers = headersWithSignature(path, token)
  const body = opts.body ? JSON.stringify(opts.body) : undefined

  const res = await fetch(url.toString(), { method, headers, body })
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''

  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) throw new Error(`FoxESS content-type: ${ct || 'brak'} — body: ${text.slice(0, 200)}`)

  let json: any
  try { json = JSON.parse(text) } catch { throw new Error(`FoxESS nie-JSON: ${text.slice(0, 200)}`) }
  if (typeof json?.errno === 'number' && json.errno !== 0) {
    throw new Error(`FoxESS errno ${json.errno}: ${json?.msg || 'API error'}`)
  }
  return json as T
}

// Przykłady wysokopoziomowych wywołań:
export async function foxessReportDay(sn: string, date: Date, variable = 'feedin') {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  return foxessRequest({
    path: '/op/v0/device/report/query',
    method: 'POST',
    body: { sn, year: y, month: m, day: d, dimension: 'day', variables: [variable] }
  })
}

export async function foxessDeviceDetail(sn: string) {
  // Uwaga: dokument podaje przykład GET z query; header podpisujemy na samym "path"
  const base = (process.env.FOXESS_API_BASE || DEFAULT_BASE).trim()
  const token = (process.env.FOXESS_API_TOKEN || '').trim()
  const path = '/op/v0/device/detail'
  const url = new URL(path, base)
  url.searchParams.set('sn', sn)
  // ale podpis na sam "path":
  const headers = headersWithSignature(path, token)
  const res = await fetch(url.toString(), { headers, method: 'GET' })
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error(`FoxESS content-type: ${ct || 'brak'} — body: ${text.slice(0, 200)}`)
  const json = JSON.parse(text)
  if (json?.errno !== 0) throw new Error(`FoxESS errno ${json?.errno}: ${json?.msg || 'API error'}`)
  return json
}
