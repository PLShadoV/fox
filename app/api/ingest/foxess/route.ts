import { NextRequest, NextResponse } from "next/server";
import { getFoxRealtime } from "@lib/foxess";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') || 'realtime';
  if (kind !== 'realtime') return NextResponse.json({ error: 'only realtime in demo' }, { status: 400 });
  try {
    const data = await getFoxRealtime();
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'foxess error' }, { status: 500 });
  }
}
