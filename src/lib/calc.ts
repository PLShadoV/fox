import { prisma } from "@/src/db";

/** Sumuje profit z tabeli profitHour (jeśli istnieje). Gdy brak modelu/kolumny – zwraca 0. */
export async function getTodayNetPLN(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  try {
    const start = new Date();
    start.setHours(0,0,0,0);
    const rows = await (prisma as any)?.profitHour?.findMany?.({
      where: { ts: { gte: start } },
      select: { profitPLN: true }
    });
    if (Array.isArray(rows)) {
      return rows.reduce((s: number, r: any) => s + (Number(r?.profitPLN) || 0), 0);
    }
  } catch {}
  return 0;
}
