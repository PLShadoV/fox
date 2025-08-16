// lib/providers/foxess.ts
import { EnergyPoint } from '../types'
import crypto from 'crypto'

const TZ = 'Europe/Warsaw'

/** Podpis MD5 dla FoxESS: path + "\\r\\n" + token + "\\r\\n" + timestamp (literalne backslashe!) */
function foxHeaders(path: string, tokenRaw: string) {
  const token = (tokenRaw || '').trim()
  const timestamp = Date.now().toString()
  const JOIN = '\\r\\n' // ← LITERALNE \r\n, nie prawdziwy CRLF
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
  }
}

/** ISO z godziną ścienną w Europe/Warsaw */
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(seed)
  const Y = Number(parts.find((p) => p.type === 'year')!.value)
  const M = Number(parts.find((p) => p.type === 'month')!.value)
  const D = Number(parts.find((p) => p.type === 'day')!.value)
  const H = Number(parts.find((p) => p.type === 'hour')!.value)
  const warsawAsUTC = new Date(Date.UTC(Y, M - 1, D, H, 0, 0))
  return warsawAsUTC.toISOString()
}

/** FoxESS Cloud: /op/v0/device/report/query (zmienna domyślnie "feedin") */
async function viaFoxCloud(fromISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_API_BASE || 'https://www.foxesscloud.com'
  const token = process.env.FOXESS_API_TOKEN
  const sn = process.env.FOXESS_DEVICE_SN
  const variable = (process.env.FOXESS_VARIABLE || 'feedin').toLowerCase()
  const path = '/op/v0/device/report/query'

  if (!token) throw new Error('Brak FOXESS_API_TOKEN')
  if (!sn) throw new Error('Brak FOXESS_DEVICE_SN')

  const d = new Date(fromISO)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()

  const url = new URL(path, base)
  const body = { sn, year: y, month: m, day, dimension: 'day', variables: [variable] }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, token),
    body: JSON.stringify(body),
    next: { revalidate: 300 },
  })

  const ct = res.headers.get('content-type') || ''
  const text = await res.text()

  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) {
    throw new Error(`FoxESS zwrócił ${ct || 'brak content-type'}. Fragment: ${text.slice(0, 200)}`)
  }

  const json = JSON.parse(text)
  if (typeof json?.errno === 'number' && json.errno !== 0) {
    const msg = json?.msg || json?.message || 'FoxESS API error'
    throw new Error(`FoxESS errno ${json.errno}: ${msg}`)
  }

  const series =
    (json?.result || []).find((v: any) => (v?.variable || '').toLowerCase() === variable)?.values ?? []

  const out: EnergyPoint[] = []
  for (let h = 0; h < 24; h++) {
    const val = Number(series[h] ?? 0)
    out.push({ timestamp: isoForWarsawHour(y, m - 1, day, h), exported_kwh: isFinite(val) ? val : 0 })
  }
  return out
}

/** Tryb: zewnętrzny proxy/worker (np. Cloudflare) */
async function viaProxy(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_PROXY_URL
  const sn = process.env.FOXESS_DEVICE_SN ?? ''
  if (!base) throw new Error('Brak FOXESS_PROXY_URL')
  const url = new URL('/energy/hourly', base)
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)
  if (sn) url.searchParams.set('sn', sn)
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`FoxESS proxy failed: ${res.status}`)
  return (await res.json()) as EnergyPoint[]
}

/** Tryb: endpoint zwracający już [{ timestamp, exported_kwh }] */
async function viaJson(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_JSON_URL
  const sn = process.env.FOXESS_DEVICE_SN ?? ''
  if (!base) throw new Error('Brak FOXESS_JSON_URL')
  const url = new URL(base)
  if (!url.searchParams.has('from')) url.searchParams.set('from', fromISO)
  if (!url.searchParams.has('to')) url.searchParams.set('to', toISO)
  if (sn && !url.searchParams.has('sn')) url.searchParams.set('sn', sn)
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`FoxESS json failed: ${res.status}`)
  return (await res.json()) as EnergyPoint[]
}

/** Tryb: generyczny "cloud" (Bearer) */
async function viaGenericCloud(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_API_BASE
  const token = process.env.FOXESS_API_TOKEN
  const sn = process.env.FOXESS_DEVICE_SN ?? ''
  const path = process.env.FOXESS_API_PATH ?? '/energy/hourly'
  const method = (process.env.FOXESS_API_METHOD ?? 'GET').toUpperCase()
  if (!base || !token) throw new Error('Brak FOXESS_API_BASE lub FOXESS_API_TOKEN')

  const url = new URL(path, base)
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)
  if (sn) url.searchParams.set('sn', sn)

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    next: { revalidate: 300 },
  }
  if (method === 'POST') {
    delete (init as any).next
    init.body = JSON.stringify({ from: fromISO, to: toISO, sn })
  }

  const res = await fetch(url.toString(), init)
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`FoxESS cloud HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) {
    throw new Error(`FoxESS cloud zwrócił ${ct || 'brak content-type'}. Fragment: ${text.slice(0, 200)}`)
  }

  const raw = JSON.parse(text)
  if (Array.isArray(raw) && raw.length && 'timestamp' in raw[0] && 'exported_kwh' in raw[0]) {
    return raw as EnergyPoint[]
  }
  if (raw?.data && Array.isArray(raw.data)) {
    return raw.data.map((r: any) => ({
      timestamp: r.timestamp ?? r.time ?? r.datetime,
      exported_kwh: Number(r.exported_kwh ?? r.export ?? r.kwh ?? 0),
    })) as EnergyPoint[]
  }
  throw new Error('Nieznany format odpowiedzi z API – dostosuj mapping w lib/providers/foxess.ts')
}

/** Publiczne API providera */
export async function fetchFoxEssHourlyExported(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const mode = process.env.FOXESS_MODE ?? 'mock'
  if (mode === 'proxy') return viaProxy(fromISO, toISO)
  if (mode === 'json') return viaJson(fromISO, toISO)
  if (mode === 'cloud') {
    if ((process.env.FOXESS_API_BASE || '').includes('foxesscloud.com')) {
      return viaFoxCloud(fromISO)
    }
    return viaGenericCloud(fromISO, toISO)
  }

  // fallback: mock
  const start = new Date(fromISO)
  const rows: EnergyPoint[] = []
  for (let i = 0; i < 24; i++) {
    const t = new Date(start)
    t.setHours(start.getHours() + i)
    rows.push({ timestamp: t.toISOString(), exported_kwh: +(Math.random() * 2).toFixed(3) })
  }
  return rows
}
