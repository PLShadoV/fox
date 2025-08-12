import { NextRequest, NextResponse } from "next/server";
import { getFoxessHourly, getFoxessHourlyRange } from "@/lib/foxess";

export async function GET(req: NextRequest) {
  const date = (req.nextUrl.searchParams.get("date") ?? undefined);
  const start = (req.nextUrl.searchParams.get("start") ?? undefined);
  const end = (req.nextUrl.searchParams.get("end") ?? undefined);
  try {
    if (start && end) {
      const data = await getFoxessHourlyRange(start, end);
      return NextResponse.json({ start, end, data });
    }
    const target = date ?? new Date().toISOString().slice(0,10);
    const data = await getFoxessHourly(target);
    return NextResponse.json({ date: target, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
