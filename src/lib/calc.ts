import { prisma } from "@db";

export async function getTodayNetPLN(): Promise<number> {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  const rows = await prisma.profitHour.findMany({ where: { ts: { gte: start, lte: end } } });
  return rows.reduce((acc, r) => acc + (r.netPLN || 0), 0);
}

// revenuePLN = (exportWh / 1000) * (pricePLNMWh / 1000)
export function revenuePLN(exportWh: number, pricePLNMWh: number): number {
  return (exportWh / 1000) * (pricePLNMWh / 1000);
}
