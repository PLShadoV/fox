import { NextRequest, NextResponse } from "next/server";
import { sendTuyaCommand } from "@/src/lib/tuya";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest){
  try{
    const body = await req.json();
    const data = await sendTuyaCommand(body);
    return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
