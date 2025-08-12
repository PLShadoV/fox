import { NextResponse } from "next/server";
import { getFoxRealtime } from "@/src/lib/foxess";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(){
  try{
    const data:any = await getFoxRealtime();
    return NextResponse.json({ ok:true, sample: { pvPowerW: data?.pvPowerW, gridExportW: data?.gridExportW, gridImportW: data?.gridImportW }, raw: data?.raw ?? null });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
