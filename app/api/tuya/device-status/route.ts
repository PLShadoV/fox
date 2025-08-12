import { NextRequest, NextResponse } from "next/server";
import { tuyaDeviceStatus } from "@lib/tuya";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId') || '';
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  try {
    const data = await tuyaDeviceStatus(deviceId);
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'tuya status error' }, { status: 500 });
  }
}
