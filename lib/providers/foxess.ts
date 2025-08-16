import { EnergyPoint } from '../types'

// Provider supports modes via env:
// FOXESS_MODE: 'mock' | 'proxy'
//  - 'proxy': call a JSON proxy that returns [{ timestamp, exported_kwh }]
// FOXESS_PROXY_URL: URL of your proxy endpoint
// FOXESS_DEVICE_SN: your inverter serial number (e.g. 603T253021ND064)

export async function fetchFoxEssHourlyExported(fromISO: string, toISO: string): Promise<EnergyPoint[]> {
  const mode = process.env.FOXESS_MODE ?? 'mock'
  const sn = process.env.FOXESS_DEVICE_SN

  if (mode === 'proxy') {
    const base = process.env.FOXESS_PROXY_URL
    if (!base) throw new Error('Brak FOXESS_PROXY_URL')
    const url = new URL('/energy/hourly', base)
    url.searchParams.set('from', fromISO)
    url.searchParams.set('to', toISO)
    if (sn) url.searchParams.set('sn', sn)

    const res = await fetch(url.toString(), { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`FoxESS proxy failed: ${res.status}`)
    const data = await res.json()
    return data as EnergyPoint[]
  }

  // default mock
  const start = new Date(fromISO)
  const rows: EnergyPoint[] = []
  for (let i = 0; i < 24; i++) {
    const t = new Date(start)
    t.setHours(start.getHours() + i)
    rows.push({ timestamp: t.toISOString(), exported_kwh: +(Math.random() * 2).toFixed(3) })
  }
  return rows
}
