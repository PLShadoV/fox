import { NextRequest, NextResponse } from "next/server";
import { sendTuyaCommand } from "@lib/tuya";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.deviceId || !body?.dpCode) {
    return NextResponse.json({ error: 'deviceId, dpCode, value required' }, { status: 400 });
  }
  try {
    const res = await sendTuyaCommand(body.deviceId, body.dpCode, body.value);
    return NextResponse.json(res);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'tuya control error' }, { status: 500 });
  }
}
