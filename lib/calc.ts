export type HourlyPoint = { time: string; price: number }; // price in PLN/kWh
export type EnergyPoint = { time: string; exportKwh: number; importKwh: number; pvKwh: number };

export function mergeByHour(energy: EnergyPoint[], prices: HourlyPoint[]) {
  const priceMap = new Map(prices.map(p => [p.time, p.price]));
  return energy.map(e => ({
    ...e,
    price: priceMap.get(e.time) ?? null
  }));
}

export function revenueForPeriod(merged: ReturnType<typeof mergeByHour>) {
  let revenue = 0;
  let exported = 0;
  let imported = 0;
  let pv = 0;
  let pricedHours = 0;
  for (const row of merged) {
    pv += row.pvKwh;
    exported += row.exportKwh;
    imported += row.importKwh;
    if (row.price != null) {
      revenue += row.exportKwh * row.price;
      pricedHours += 1;
    }
  }
  const avgPrice = merged.length ? (merged.reduce((s, r) => s + (r.price ?? 0), 0) / (pricedHours || 1)) : 0;
  return { revenue, exported, imported, pv, avgPrice };
}
