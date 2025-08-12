import { NextRequest, NextResponse } from "next/server";
import { getRCEmMonth } from "@lib/rcem";

export async function GET(req: NextRequest) {
  const yyyymm = req.nextUrl.searchParams.get('yyyymm');
  if (!yyyymm) return NextResponse.json({ error: 'yyyymm required' }, { status: 400 });
  const row = await getRCEmMonth(yyyymm);
  return NextResponse.json(row);
}
