import { NextRequest, NextResponse } from "next/server";
import { getRceHourly } from "@/lib/rce";

export async function GET(req: NextRequest) {
  const date = (req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0,10));
  try {
    const data = await getRceHourly(date);
    return NextResponse.json({ date, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
