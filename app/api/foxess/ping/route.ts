import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    sample: { pvPowerW: 0, gridExportW: 0, gridImportW: 0 },
    raw: { msg: 'stub ok' }
  });
}
