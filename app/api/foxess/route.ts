import { NextRequest } from 'next/server'
import { fetchFoxEssHourlyExported } from '@/lib/providers/foxess'
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from'); const to = searchParams.get('to')
  if(!from||!to) return new Response('Missing from/to', { status: 400 })
  try { const data = await fetchFoxEssHourlyExported(from, to); return Response.json(data) }
  catch(e:any){ return new Response(e.message ?? 'FoxESS error', { status: 500 }) }
}
