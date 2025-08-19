
'use client';
import { useState } from 'react';

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Totals = { kwh: number; revenue_pln: number };
type Result = { rce: Totals; rcem: Totals; from: string; to: string; days: number };

async function fetchDay(mode: 'rce'|'rcem', date: string){
  const r = await fetch(`/api/revenue/day?mode=${mode}&date=${date}`, { cache: 'no-store' });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || 'Błąd pobierania');
  return j.totals as Totals;
}

export default function RangeCalculator() {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  function defaultIfEmpty() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6); // ostatnie 7 dni
    return { from: toISO(start), to: toISO(today) };
  }

  async function onCompute() {
    try {
      setError(null);
      setLoading(true);
      const f = from || defaultIfEmpty().from;
      const t = to || defaultIfEmpty().to;

      const d0 = new Date(f + 'T00:00:00');
      const d1 = new Date(t + 'T00:00:00');
      if (isNaN(d0.getTime()) || isNaN(d1.getTime()) || d0 > d1) {
        throw new Error('Zakres dat jest nieprawidłowy.');
      }

      let rce: Totals = { kwh: 0, revenue_pln: 0 };
      let rcem: Totals = { kwh: 0, revenue_pln: 0 };

      for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
        const [dRce, dRcem] = await Promise.all([fetchDay('rce', iso), fetchDay('rcem', iso)]);
        rce = { kwh: rce.kwh + dRce.kwh, revenue_pln: Number((rce.revenue_pln + dRce.revenue_pln).toFixed(2)) };
        rcem = { kwh: rcem.kwh + dRcem.kwh, revenue_pln: Number((rcem.revenue_pln + dRcem.revenue_pln).toFixed(2)) };
      }

      const days = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
      setRes({ rce, rcem, from: f, to: t, days });
    } catch (e:any) {
      setError(e?.message || String(e));
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  const finalFrom = from || defaultIfEmpty().from;
  const finalTo = to || defaultIfEmpty().to;

  const diff = res ? Number((res.rcem.revenue_pln - res.rce.revenue_pln).toFixed(2)) : 0;
  const better = diff === 0 ? '—' : (diff > 0 ? 'RCEm wyższe' : 'RCE wyższe');

  return (
    <div className="pv-card p-5 glass glass-border">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-semibold">Kalkulator zakresu — porównanie RCE vs RCEm</h3>
        <div className="text-xs text-slate-400">Ujemne ceny RCE są liczone jako 0 do przychodu.</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm muted">Od (YYYY-MM-DD)</span>
          <input type="date" className="glass-input" value={from} onChange={e=>setFrom(e.target.value)} placeholder={finalFrom} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm muted">Do (YYYY-MM-DD)</span>
          <input type="date" className="glass-input" value={to} onChange={e=>setTo(e.target.value)} placeholder={finalTo} />
        </label>
        <div className="flex items-end">
          <button onClick={onCompute} disabled={loading} className="pv-btn">{loading ? 'Liczenie…' : 'Oblicz'}</button>
        </div>
      </div>

      {error && <div className="mt-3 text-red-400">{error}</div>}

      {res && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-xl border glass-border">
            <div className="text-xs uppercase tracking-wide muted">Zakres</div>
            <div className="text-xl font-semibold mt-1">{res.from} → {res.to}</div>
            <div className="text-sm muted mt-1">{res.days} dni</div>
          </div>
          <div className="glass p-4 rounded-xl border glass-border">
            <div className="text-xs uppercase tracking-wide muted">Przychód RCE</div>
            <div className="text-3xl font-semibold mt-1">{res.rce.revenue_pln.toFixed(2)} <span className="text-base">PLN</span></div>
            <div className="text-sm muted mt-1">Generation: {res.rce.kwh.toFixed(1)} kWh</div>
          </div>
          <div className="glass p-4 rounded-xl border glass-border">
            <div className="text-xs uppercase tracking-wide muted">Przychód RCEm</div>
            <div className="text-3xl font-semibold mt-1">{res.rcem.revenue_pln.toFixed(2)} <span className="text-base">PLN</span></div>
            <div className="text-sm muted mt-1">Generation: {res.rcem.kwh.toFixed(1)} kWh</div>
          </div>

          <div className="lg:col-span-3 glass p-4 rounded-xl border glass-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide muted">Różnica (RCEm − RCE)</div>
                <div className="text-2xl font-semibold mt-1">{diff.toFixed(2)} PLN</div>
              </div>
              <div className="text-sm muted">{better}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
