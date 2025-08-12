import { NextRequest, NextResponse } from "next/server";
import { getRceHourlyRange } from "@/lib/rce";

export async function GET(req: NextRequest) {
  const start = (req.nextUrl.searchParams.get("start") ?? undefined);
  const end = (req.nextUrl.searchParams.get("end") ?? undefined);
  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }
  try {
    const data = await getRceHourlyRange(start, end);
    return NextResponse.json({ start, end, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
