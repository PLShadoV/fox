import { NextResponse } from "next/server";
import { getToken } from "@/src/db/oauth";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await getToken("foxess");
  return NextResponse.json({ connected: !!t, expiresAt: t?.expiresAt ?? null });
}
