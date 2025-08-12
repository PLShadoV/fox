import { NextRequest, NextResponse } from "next/server";
import { getFoxRealtime } from "@/src/lib/foxess";
import { prisma } from "@/src/db";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const store = req.nextUrl.searchParams.get('store');
    const data = await getFoxRealtime();
    if (store === '1') {
      await prisma.inverterReading.create({
        data: {
          ts: new Date(),
          pvPowerW: Math.round(data.pvPowerW || 0),
          gridExportW: Math.round(data.gridExportW || 0),
          gridImportW: Math.round(data.gridImportW || 0),
          batterySOC: typeof data.batterySOC === 'number' ? Math.round(data.batterySOC) : null
        }
      });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
