import { NextRequest, NextResponse } from "next/server";
import { tuyaDeviceStatus } from "@lib/tuya";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId") || "";

  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Missing deviceId" }, { status: 400 });
  }

  const configured = !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
  if (!configured) {
    return NextResponse.json({ ok: false, error: "Tuya not configured" }, { status: 501 });
  }

  const data = await tuyaDeviceStatus(deviceId);
  const status = (data as any)?.status ?? (data as any)?.ok ? 200 : 500;
  return NextResponse.json(data, { status });
}
