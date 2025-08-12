import { NextRequest, NextResponse } from "next/server";
import { getFoxRealtime } from "@/src/lib/foxess";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest){
  try{
    const fast = req.nextUrl.searchParams.get('fast') === '1';
    const attempts = Number(req.nextUrl.searchParams.get('attempts') || 24);
    const timeoutMs = Number(req.nextUrl.searchParams.get('timeoutMs') || 3000);
    const data:any = await getFoxRealtime({ fast, maxAttempts: attempts, perAttemptMs: timeoutMs });
    const errno = data?.raw?.errno;
    const ok = !errno;
    return NextResponse.json({
      ok,
      errno: errno ?? null,
      sample: { pvPowerW: data?.pvPowerW, gridExportW: data?.gridExportW, gridImportW: data?.gridImportW },
      raw: data?.raw ?? null
    }, { status: ok? 200: 502 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
