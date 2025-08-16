// lib/providers/foxess.ts
import { EnergyPoint } from '../types'
import crypto from 'crypto'

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

async function viaFoxCloud(fromISO: string): Promise<EnergyPoint[]> {
  const base = process.env.FOXESS_API_BASE!
  const token = process.env.FOXESS_API_TOKEN!
  const sn = process.env.FOXESS_DEVICE_SN!
  const path = '/op/v0/device/report/query'

  // bierzemy dzień z parametru `from` (tak jak w /api/rce/pse)
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
    dimension: 'day',               // zwraca godzinowe wartości dla danego dnia
    variables: ['feedin']           // energia oddana [kWh]
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: foxHeaders(path, token),
    body: JSON.stringify(body),
    next: { revalidate: 300 }
  })

  // czytelne błędy, jeśli API zwróci HTML/redirect itp.
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status} — ${text.slice(0, 200)}`)
  if (!ct.includes('application/json')) {
    throw new Error(`FoxESS zwrócił ${ct || 'brak content-type'} (czy to strona logowania?). Fragment: ${text.slice(0, 200)}`)
  }

  const json = JSON.parse(text)
  const series = json?.result?.find((v: any) => v.variable === 'feedin')?.values ?? []
  const out: EnergyPoint[] = []
  for (let h = 0; h < 24; h++) {
    const val = Number(series[h] ?? 0)
    // znacznik czasu budujemy jako UTC godzina po godzinie
    const ts = new Date(Date.UTC(y, m - 1, day, h)).toISOString()
    out.push({ timestamp: ts, exported_kwh: val })
  }
  return out
}

export async function fetchFoxEssHourlyExported(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const mode = process.env.FOXESS_MODE ?? 'mock'
  if (mode === 'cloud') {
    // gdy base wskazuje na FoxESS Cloud – użyj ich schematu nagłówków + report/query
    if ((process.env.FOXESS_API_BASE || '').includes('foxesscloud.com')) {
      return viaFoxCloud(fromISO)
    }
    // ...tu może zostać Twój wcześniejszy „generyczny” cloud (Bearer itd.)
    throw new Error('Skonfiguruj FOXESS_API_BASE na https://www.foxesscloud.com lub włącz tryb json/proxy/mock')
  }

  // inne tryby (json/proxy/mock) jak wcześniej…
  // (zostaw bez zmian jeśli już masz)
  const start = new Date(fromISO)
  const rows: EnergyPoint[] = []
  for (let i = 0; i < 24; i++) {
    const t = new Date(start); t.setHours(start.getHours() + i)
    rows.push({ timestamp: t.toISOString(), exported_kwh: +(Math.random() * 2).toFixed(3) })
  }
  return rows
}
