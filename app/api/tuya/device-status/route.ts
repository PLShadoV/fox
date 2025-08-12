import { NextRequest, NextResponse } from "next/server";
import { tuyaDeviceStatus } from "@/src/lib/tuya";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest){
  const deviceId = req.nextUrl.searchParams.get('deviceId') || undefined;
  try{
    const data = await tuyaDeviceStatus(deviceId);
    return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
