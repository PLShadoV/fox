import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(){
  const env = {
    hasDb: !!process.env.DATABASE_URL,
    hasFoxToken: !!process.env.FOXESS_API_KEY,
    hasSn: !!process.env.FOXESS_DEVICE_SN,
    base: process.env.FOXESS_API_BASE || "https://www.foxesscloud.com",
    tz: process.env.FOXESS_TIMEZONE || "Europe/Warsaw"
  };
  return NextResponse.json({ ok: true, env, timeNow: new Date().toISOString(), nodeVersion: process.version });
}
