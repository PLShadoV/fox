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


/**
 * PSE API v2 – RCE-PLN (https://api.raporty.pse.pl/api/rce-pln)
 * Zwraca listę godzinowych cen w PLN/MWh dla podanego dnia.
 * date: 'today' lub 'YYYY-MM-DD'
 */
export async function getRCEPLN(date: string) {
  let day: string;
  if (date === 'today') {
    const d = new Date();
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    day = `${y}-${m}-${dd}`;
  } else {
    day = date;
  }
  const base = process.env.PSE_API_BASE || "https://api.raporty.pse.pl/api";
  // OData-like filter by business_date; API often accepts eq 'YYYY-MM-DD'
  const url = `${base}/rce-pln?$filter=business_date eq '${day}'`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PSE RCE-PLN HTTP ${res.status}: ${t}`);
  }
  const data = await res.json();
  // Normalize to [{hour, rce_pln, business_date, udtczas}]
  const rows = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : []);
  return rows;
}
