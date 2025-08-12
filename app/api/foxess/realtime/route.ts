import { NextResponse } from "next/server";
import { readFoxRealtime } from "@/src/lib/foxess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readFoxRealtime();
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "FoxESS error" }, { status: 500 });
  }
}
