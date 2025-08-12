import { NextRequest, NextResponse } from "next/server";
import { getRCEPLN } from "@lib/rcem";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || 'today';
  try {
    const rows = await getRCEPLN(date);
    return NextResponse.json(rows);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'rce-pln error' }, { status: 500 });
  }
}
