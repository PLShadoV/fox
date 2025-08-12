'use client';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';

function HeatCell({ value }: { value: number }) {
  // value in PLN/MWh – simple scale
  const min = 150, max = 900;
  const v = Math.max(min, Math.min(max, value));
  const ratio = (v - min) / (max - min); // 0..1
  const hue = 210 - Math.round(ratio * 210); // blue->red
  const bg = `hsl(${hue} 70% 20% / 0.6)`;
  const border = `hsl(${hue} 80% 30% / 0.7)`;
  return <td style={{ background: bg, borderColor: border }} className="border text-center py-1 text-sm">{value.toFixed(0)}</td>;
}

function TableDA({ rows }: { rows: { ts: string; price: number }[] }) {
  if (!rows?.length) return <div className="muted text-sm">Brak danych</div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-white/10 rounded-xl overflow-hidden">
        <thead>
          <tr>
            <th className="text-left p-2 text-xs uppercase tracking-wide muted">Godzina</th>
            {rows.map((r, i) => <th key={i} className="text-center p-2 text-xs muted">{r.ts}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 text-xs uppercase muted">PLN/MWh</td>
            {rows.map((r, i) => <HeatCell key={i} value={r.price} />)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TableRCE({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div className="muted text-sm">Brak danych</div>;
  // Expect objects with fields hour or settlement_hour and rce_pln
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-white/10 rounded-xl overflow-hidden">
        <thead>
          <tr>
            <th className="text-left p-2 text-xs uppercase tracking-wide muted">Godzina</th>
            {rows.map((r, i) => <th key={i} className="text-center p-2 text-xs muted">{String(r.settlement_hour ?? r.hour).padStart(2,'0')}:00</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 text-xs uppercase muted">PLN/MWh</td>
            {rows.map((r, i) => <HeatCell key={i} value={Number(r.rce_pln ?? r.price_pln_mwh ?? r.value)} />)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function PricesPage() {
  const [date, setDate] = useState<string>('today');
  const [da, setDa] = useState<any[]>([]);
  const [rce, setRce] = useState<any[]>([]);
  const [yyyymm, setYyyymm] = useState<string>('2025-08');
  const [rcem, setRcem] = useState<any|null>(null);

  const loadDA = async () => {
    const r = await fetch('/api/prices/da?date=' + encodeURIComponent(date));
    setDa(await r.json());
  };
  const loadRCE = async () => {
    const r = await fetch('/api/prices/rce-pln?date=' + encodeURIComponent(date));
    setRce(await r.json());
  };
  const loadRCEm = async () => {
    const r = await fetch('/api/prices/rcem?yyyymm=' + encodeURIComponent(yyyymm));
    setRcem(await r.json());
  };

  useEffect(() => { loadDA(); loadRCE(); }, []);

  return (
    <main className="grid gap-4">
      <PageHeader title="Ceny energii" subtitle="Day‑Ahead (ENTSO‑E) i RCE‑PLN (PSE), plus RCEm" />
      <div className="container grid grid-cols-1 gap-6">
        <Card title="Day‑Ahead (ENTSO‑E)" subtitle="PLN/MWh dla wybranego dnia" right={
          <div className="flex items-center gap-2">
            <input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
            <button onClick={loadDA} className="btn">Pobierz</button>
          </div>
        }>
          <TableDA rows={Array.isArray(da) ? da : []} />
        </Card>

        <Card title="RCE‑PLN (PSE)" subtitle="Godzinowa cena w PLN/MWh" right={
          <div className="flex items-center gap-2">
            <input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
            <button onClick={loadRCE} className="btn">Pobierz</button>
          </div>
        }>
          <TableRCE rows={Array.isArray(rce) ? rce : []} />
        </Card>

        <Card title="RCEm (miesięczna)" subtitle="Jeśli nie podasz feedu, użyta będzie wartość domyślna" right={
          <div className="flex items-center gap-2">
            <input className="input w-36" value={yyyymm} onChange={e=>setYyyymm(e.target.value)} placeholder="YYYY-MM" />
            <button onClick={loadRCEm} className="btn">Pobierz</button>
          </div>
        }>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(rcem, null, 2)}</pre>
        </Card>
      </div>
    </main>
  );
}
