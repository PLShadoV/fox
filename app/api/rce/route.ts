import { NextRequest } from 'next/server'

type RceRow = {
  rce_pln?: number // cena w PLN/MWh
  RCE?: number     // niekiedy pole bywa nazwane RCE
  dtime_utc?: string
  period_utc?: string
  udtczas?: string
  udtczas_oreb?: string
  business_date?: string // 'YYYY-MM-DD'
  period?: number        // 1..24 (godzina handlowa)
}

function isoFromBusinessAndPeriod(business: string, period?: number) {
  if (!business || !period) return null
  // period 1 = 00:00-01:00 → bierzemy początek godziny w UTC
  const hour = Math.max(0, Math.min(23, (period as number) - 1))
  const d = new Date(`${business}T00:00:00Z`)
  d.setUTCHours(hour)
  return d.toISOString()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return new Response('Missing from/to', { status: 400 })

  // bierzemy DOBĘ z parametru "from"
  const day = new Date(from).toISOString().slice(0, 10)

  // PSE API v2 – RCE
  // Przykład: https://api.raporty.pse.pl/api/rce-pln?$filter=business_date eq '2025-02-16'&$orderby=dtime_utc asc
  const url = new URL('https://api.raporty.pse.pl/api/rce-pln')
  url.searchParams.set('$filter', `business_date eq '${day}'`)
  url.searchParams.set('$orderby', 'dtime_utc asc')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const text = await res.text()

  if (!res.ok) {
    return new Response(`PSE API error ${res.status}: ${text.slice(0, 200)}`, { status: 502 })
  }

  // OData zwykle zwraca { value: [...] }, ale na wszelki wypadek obsłużmy też czystą tablicę
  let raw: any
  try { raw = JSON.parse(text) } catch {
    return new Response(`PSE unexpected content-type. Body: ${text.slice(0, 120)}`, { status: 502 })
  }
  const rows: RceRow[] = Array.isArray(raw) ? raw : (raw?.value ?? raw?.items ?? [])

  const out = rows.map((r) => {
    const ts =
      r.dtime_utc ||
      r.period_utc ||
      r.udtczas ||
      r.udtczas_oreb ||
      isoFromBusinessAndPeriod(r.business_date ?? day, r.period)

    const mwh = Number(r.rce_pln ?? r.RCE ?? NaN)
    // PLN/MWh → PLN/kWh
    const price_pln_per_kwh = Number.isFinite(mwh) ? mwh / 1000 : NaN

    return ts && Number.isFinite(price_pln_per_kwh)
      ? { timestamp: new Date(ts).toISOString(), price_pln_per_kwh }
      : null
  }).filter(Boolean) as { timestamp: string; price_pln_per_kwh: number }[]

  return Response.json(out)
}
