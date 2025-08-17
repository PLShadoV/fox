// app/api/rce/debug/route.ts
import { NextRequest } from 'next/server'
import { fetchRcePlnMap, debugRceDay } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const day = u.searchParams.get('day') // YYYY-MM-DD (PL)
  if (!day) return Response.json({ ok:false, error:'podaj ?day=YYYY-MM-DD' }, { status: 400 })

  const from = new Date(`${day}T00:00:00.000Z`).toISOString()
  const to   = new Date(`${day}T23:59:59.999Z`).toISOString()

  const map = await fetchRcePlnMap(from, to)
  const dbg = await debugRceDay(day)

  const sample = [...map.entries()].slice(0, 5).map(([ts, price]) => ({ ts, price }))

  return Response.json({
    ok: true,
    count: map.size,
    tried: dbg.tried,       // pokaże kolejno filtry i liczbę rekordów
    sample
  })
}
