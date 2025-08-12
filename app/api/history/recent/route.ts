import { NextResponse } from "next/server";
import { prisma } from "@/src/db";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await prisma.inverterReading.findMany({
    orderBy: { ts: 'desc' },
    take: 200
  });
  return NextResponse.json(rows);
}
