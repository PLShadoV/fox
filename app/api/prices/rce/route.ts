import { NextResponse } from "next/server";
import { readRCE } from "@/src/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readRCE();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "RCE error" }, { status: 500 });
  }
}
