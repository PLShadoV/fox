type Row = { ts: string; pricePLNMWh: number };

export async function getDayAheadPL(date: string): Promise<Row[]> {
  // Edge/runtime safe placeholder. Replace with ENTSO-E API call.
  const now = new Date();
  const hours = Array.from({ length: 24 }, (_, h) => {
    const d = new Date(now); d.setHours(h,0,0,0);
    return { ts: d.toISOString().slice(11,16), pricePLNMWh: 450 + Math.round(Math.sin(h/24*Math.PI*2)*50) };
  });
  return hours;
}
