import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return new Response('Missing from/to', { status: 400 })

  // Fetch a single-day CSV from raporty.pse.pl for the day of 'from'
  const day = new Date(from).toISOString().slice(0,10)
  const csvUrl = `https://raporty.pse.pl/report/rce-pln?download=csv&date=${day}`
  const res = await fetch(csvUrl, { cache: 'no-store' })
  if (!res.ok) return new Response(`PSE error: ${res.status}`, { status: 502 })
  const csv = await res.text()

  const lines = csv.trim().split(/\r?\n/)
  const sep = lines[0]?.includes(';') ? ';' : ','
  const out: { timestamp: string; price_pln_per_kwh: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(s => s.trim())
    const time = cols[0]
    const priceStr = cols[1]
    if (!time || !priceStr) continue
    const [hh] = time.split(':').map(Number)
    if (!Number.isFinite(hh)) continue
    const ts = new Date(`${day}T${String(hh).padStart(2,'0')}:00:00Z`).toISOString()
    const price = parseFloat(priceStr.replace(',', '.'))
    if (!Number.isNaN(price)) out.push({ timestamp: ts, price_pln_per_kwh: price })
  }

  return Response.json(out)
}
