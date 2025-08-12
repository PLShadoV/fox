import { NextRequest, NextResponse } from "next/server";
import { getFoxRealtime } from "@/src/lib/foxess";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest){
  try{
    // getFoxRealtime() no longer accepts params – timeouts/attempts są w środku klienta
    const data:any = await getFoxRealtime();
    const errno = data?.raw?.errno ?? null;
    const ok = !errno;
    return NextResponse.json({
      ok,
      errno,
      sample: { pvPowerW: data?.pvPowerW, gridExportW: data?.gridExportW, gridImportW: data?.gridImportW },
      raw: data?.raw ?? null
    }, { status: ok? 200: 502 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
