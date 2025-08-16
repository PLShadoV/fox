
// lib/providers/foxess.ts
import { EnergyPoint } from '../types'
import crypto from 'crypto'

const TZ = 'Europe/Warsaw'

function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex')
}
function foxHeaders(path: string, token: string) {
  const timestamp = Date.now().toString()
  const signature = md5(`${path}\r\n${token}\r\n${timestamp}`)
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

// Build an ISO timestamp that corresponds to local (Europe/Warsaw) hour h of given day y-m-d
// This ensures alignment with PSE, which we also display/merge in Warsaw time.
function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  // take local time in Warsaw, then convert to actual UTC instant
  const local = new Date(Date.UTC(y, m1, d, h)) // seed
  // Now figure out what the UTC time is when Warsaw local wall-clock equals y-m-d h:00
  // Trick: format the "seed" as Warsaw, parse back as UTC, then shift by the difference of hours.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(local)
  const Y = Number(parts.find(p => p.type === 'year')!.value)
  const M = Number(parts.find(p => p.type === 'month')!.value)
  const D = Number(parts.find(p => p.type === 'day')!.value)
  const H = Number(parts.find(p => p.type === 'hour')!.value)
  const MM = Number(parts.find(p => p.type === 'minute')!.value)
  const SS = Number(parts.find(p => p.type === 'second')!.value)
  // Construct a Date that represents that Warsaw wall-clock in UTC terms by asking
  // "what instant has these fields in Warsaw", which is:
  const warsawAsUTC = new Date(Date.UTC(Y, M - 1, D, H, MM, SS))
  // The "local" we want is specifically y-m-d h:00 in Warsaw -> set minute/second=0
  warsawAsUTC.setUTCMinutes(0, 0, 0)
  return warsawAsUTC.toISOString()
}

async function viaFoxCloud(fromISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_API_BASE!
  const token = process.env.FOXESS_API_TOKEN!
  const sn = process.env.FOXESS_DEVICE_SN!
  const path = '/op/v0/device/report/query'

  const d = new Date(fromISO)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()

  const url = new URL(path, base)
  const body = {
    sn,
    year: y,
    month: m,
    day,
    dimension: 'day',
    variables: ['feedin'] as const
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, token),
    body: JSON.stringify(body),
    next: { revalidate: 300 }
  })

  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) {
    throw new Error(`FoxESS zwrócił ${ct || 'brak content-type'} (czy to strona logowania?). Fragment: ${text.slice(0, 200)}`)
  }

  const json = JSON.parse(text)
  // ✅ kluczowe: jeśli errno != 0 -> przerwij z czytelnym komunikatem
  if (typeof json?.errno === 'number' && json.errno !== 0) {
    const msg = json?.msg || json?.message || 'FoxESS API error'
    throw new Error(`FoxESS errno ${json.errno}: ${msg}`)
  }

  const series = (json?.result || [] as any[]).find((v: any) => v.variable === 'feedin')?.values ?? []
  if (!Array.isArray(series) || series.length === 0) {
    // Brak "feedin" zwykle oznacza brak licznika eksportu. Zwracamy 24 zera, ale to informacja dla UI,
    // żeby pokazać baner/ostrzeżenie (możesz to dodać w UI) – tu tylko logiczne 0.
    const out: EnergyPoint[] = []
    for (let h = 0; h < 24; h++) {
      out.push({ timestamp: isoForWarsawHour(y, m - 1, day, h), exported_kwh: 0 })
    }
    return out
  }

  const out: EnergyPoint[] = []
  for (let h = 0; h < 24; h++) {
    const val = Number(series[h] ?? 0)
    out.push({ timestamp: isoForWarsawHour(y, m - 1, day, h), exported_kwh: val })
  }
  return out
}

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
  return await res.json() as EnergyPoint[]
}

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
  return await res.json() as EnergyPoint[]
}

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
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    next: { revalidate: 300 }
  }
  if (method === 'POST') {
    delete (init as any).next
    init.body = JSON.stringify({ from: fromISO, to: toISO, sn })
  }
  const res = await fetch(url.toString(), init)
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`FoxESS cloud HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) throw new Error(`FoxESS cloud zwrócił ${ct || 'brak content-type'}. Fragment: ${text.slice(0, 200)}`)
  const raw = JSON.parse(text)
  if (Array.isArray(raw) && raw.length && 'timestamp' in raw[0] && 'exported_kwh' in raw[0]) return raw as EnergyPoint[]
  if (raw?.data && Array.isArray(raw.data)) {
    return raw.data.map((r: any) => ({ timestamp: r.timestamp ?? r.time ?? r.datetime, exported_kwh: Number(r.exported_kwh ?? r.export ?? r.kwh ?? 0) })) as EnergyPoint[]
  }
  throw new Error('Nieznany format odpowiedzi z API – dostosuj mapping w lib/providers/foxess.ts')
}

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

  // fallback mock
  const start = new Date(fromISO)
  const rows: EnergyPoint[] = []
  for (let i = 0; i < 24; i++) {
    const t = new Date(start); t.setHours(start.getHours() + i)
    rows.push({ timestamp: t.toISOString(), exported_kwh: +(Math.random() * 2).toFixed(3) })
  }
  return rows
}
