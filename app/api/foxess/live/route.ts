// app/api/foxess/live/route.ts
import { fetchFoxEssLive } from '@/lib/providers/foxess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const live = await fetchFoxEssLive()
    return new Response(JSON.stringify({ ok: true, ...live, ts: Date.now() }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'live error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}
