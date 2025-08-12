import { NextResponse } from "next/server";
import { getTodayNetPLN } from "@lib/calc";

export async function GET() {
  const net = await getTodayNetPLN();
  return NextResponse.json({ netPLN: net });
}
