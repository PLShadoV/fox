import { NextRequest, NextResponse } from "next/server";
import { sendTuyaCommand } from "@/src/lib/tuya";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await sendTuyaCommand(body);
    const status = res?.ok ? 200 : 400;
    return NextResponse.json(res, { status });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
  }
}
