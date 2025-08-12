import { NextRequest, NextResponse } from "next/server";
import { getTuyaMeterReading } from "@lib/tuya";

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId');
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  try {
    const data = await getTuyaMeterReading(deviceId);
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'tuya error' }, { status: 500 });
  }
}
