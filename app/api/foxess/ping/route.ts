import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const payload = {
    ok: true,
    errno: null,
    sample: { pvPowerW: 0, gridExportW: 0, gridImportW: 0 },
    raw: { result: [] }
  };
  return NextResponse.json(payload, { status: 200 });
}
