import { NextRequest, NextResponse } from "next/server";
import { getDayAheadPL } from "@lib/entsoe";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || 'today';
  const rows = await getDayAheadPL(date);
  return NextResponse.json(rows.map(r => ({ ts: r.ts, price: r.pricePLNMWh })));
}
