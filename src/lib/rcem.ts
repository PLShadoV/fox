/**
 * RCEm – miesięczna rynkowa cena energii (PLN/MWh).
 * Preferencja: podaj URL do CSV/JSON w ENV (`RCEM_FEED_URL`) z kolumnami yyyymm, rcemPLNMWh.
 * Fallback: użyj ręcznie ustawionego `RCEM_DEFAULT_PLNMWH` dla brakujących miesięcy.
 */
export async function getRCEmMonth(yyyymm: string) {
  const feed = process.env.RCEM_FEED_URL;
  if (feed) {
    try {
      const res = await fetch(feed, { cache: 'no-store' });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const arr: any[] = await res.json();
          const row = arr.find(r => String(r.yyyymm) === yyyymm);
          if (row) return { yyyymm, rcemPLNMWh: Number(row.rcemPLNMWh) };
        } else {
          const txt = await res.text();
          // naive CSV parser: yyyymm,rcemPLNMWh
          const lines = txt.split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            const [ym, val] = line.split(',').map(s => s.trim());
            if (ym === yyyymm) return { yyyymm, rcemPLNMWh: Number(val) };
          }
        }
      }
    } catch {}
  }
  const defv = Number(process.env.RCEM_DEFAULT_PLNMWH || "450");
  return { yyyymm, rcemPLNMWh: defv };
}
