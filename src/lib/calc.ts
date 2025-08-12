import { prisma } from "@/src/db";

export async function getTodayNetPLN(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const start = new Date();
  start.setHours(0,0,0,0);
  const rows = await prisma.profitHour.findMany({
    where: { ts: { gte: start } },
    select: { profitPLN: true }
  });
  return rows.reduce((s, r) => s + (r.profitPLN || 0), 0);
}
