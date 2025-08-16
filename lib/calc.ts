import { EnergyPoint, PricePoint, RevenuePoint } from './types'

// Aligns hourly series on timestamp and calculates revenue.
export function mergeAndCalcRevenue(energy: EnergyPoint[], prices: PricePoint[]): RevenuePoint[] {
  const priceMap = new Map(prices.map(p => [new Date(p.timestamp).toISOString(), p.price_pln_per_kwh]))
  return energy.map(e => {
    const key = new Date(e.timestamp).toISOString()
    const price = priceMap.get(key) ?? 0
    return {
      timestamp: key,
      exported_kwh: e.exported_kwh,
      price_pln_per_kwh: price,
      revenue_pln: round2(e.exported_kwh * price)
    }
  })
}

export function sumRevenue(rows: RevenuePoint[]) {
  const kwh = rows.reduce((a, b) => a + b.exported_kwh, 0)
  const revenue = rows.reduce((a, b) => a + b.revenue_pln, 0)
  return { total_kwh: round2(kwh), total_pln: round2(revenue) }
}

export type Aggregate = { key: string; label: string; exported_kwh: number; avg_price_pln_per_kwh: number; revenue_pln: number }

type Granularity = 'hour' | 'day' | 'week' | 'month' | 'year'

// Groups to Europe/Warsaw local time for stable energy billing views.
export function aggregate(rows: RevenuePoint[], granularity: Granularity): Aggregate[] {
  const tz = 'Europe/Warsaw'
  const buckets = new Map<string, Aggregate>()

  for (const r of rows) {
    const d = new Date(r.timestamp)
    const parts = new Intl.DateTimeFormat('pl-PL', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: granularity === 'hour' ? '2-digit' : undefined
    }).formatToParts(d)
    const y = parts.find(p => p.type === 'year')!.value
    const m = parts.find(p => p.type === 'month')!.value
    const da = parts.find(p => p.type === 'day')!.value
    const h = granularity === 'hour' ? parts.find(p => p.type === 'hour')!.value : '00'

    let key = ''
    let label = ''
    if (granularity === 'hour') { key = `${y}-${m}-${da} ${h}:00`; label = key }
    else if (granularity === 'day') { key = `${y}-${m}-${da}`; label = key }
    else if (granularity === 'month') { key = `${y}-${m}`; label = `${y}-${m}` }
    else if (granularity === 'year') { key = `${y}`; label = y }
    else if (granularity === 'week') {
      const wk = isoWeekNumber(d, tz)
      key = `${y}-W${wk.toString().padStart(2,'0')}`
      label = key
    }

    const prev = buckets.get(key)
    if (!prev) {
      buckets.set(key, { key, label, exported_kwh: r.exported_kwh, avg_price_pln_per_kwh: r.price_pln_per_kwh, revenue_pln: r.revenue_pln })
    } else {
      const totalK = prev.exported_kwh + r.exported_kwh
      const weightedPrice = (prev.avg_price_pln_per_kwh * prev.exported_kwh + r.price_pln_per_kwh * r.exported_kwh) / (totalK || 1)
      prev.exported_kwh = round2(totalK)
      prev.avg_price_pln_per_kwh = round4(weightedPrice)
      prev.revenue_pln = round2(prev.revenue_pln + r.revenue_pln)
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function isoWeekNumber(date: Date, timeZone: string) {
  // Convert to timezone by formatting parts, then reconstruct Date at local midnight
  const parts = new Intl.DateTimeFormat('pl-PL', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const d = Number(parts.find(p => p.type === 'day')!.value)
  const local = new Date(Date.UTC(y, m - 1, d))
  // ISO week algo
  const dayNum = (local.getUTCDay() + 6) % 7
  local.setUTCDate(local.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(local.getUTCFullYear(), 0, 4))
  const diff = local.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / 604800000)
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round4(n: number) { return Math.round(n * 10000) / 10000 }
