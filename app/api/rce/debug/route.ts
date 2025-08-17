// app/api/rce/debug/route.ts
import { NextRequest } from 'next/server'
import { fetchRcePlnMap, readLastRceDebug } from '@/lib/providers/rce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const day = u.searchParams.get('day') // YYYY-MM-DD (PL)
  if (!day) {
    return Response.json({ ok: false, error: 'podaj ?day=YYYY-MM-DD' }, { status: 400 })
  }

  // zakres PL: 00:00–24:00 → w UTC podajemy jako fromISO / toISO (nasz /api/data robi to tak samo)
  const fromISO = new Date(`${day}T00:00:00.000Z`).toISOString()
  const toISO   = new Date(`${day}T23:59:59.999Z`).toISOString()

  const map = await fetchRcePlnMap(fromISO, toISO, /*wantDebug*/ true)
  const dbg = readLastRceDebug()

  const sample = Array.from(map.entries())
    .slice(0, 6)
    .map(([ts, price]) => ({ ts, price }))

  return Response.json({
    ok: true,
    day,
    count: map.size,
    debug: dbg,
    sample
  })
}
