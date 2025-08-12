
'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';

function VerticalTable({ rows, labelHour='Godzina', labelPrice='PLN/MWh', accessorHour='ts', accessorPrice='price' }:{ rows:any[], labelHour?:string, labelPrice?:string, accessorHour?:string, accessorPrice?:string }){
  if (!Array.isArray(rows) || !rows.length) return <div className="muted text-sm">Brak danych</div>;
  const fmtH = (v:any)=> {
    const s = String(v ?? '');
    return s.includes(':') ? s : String(v).padStart(2,'0') + ':00';
  };
  const val = (x:any)=> Number(x?.[accessorPrice] ?? x?.rce_pln ?? x?.price_pln_mwh ?? x?.value);
  const hour = (x:any)=> x?.[accessorHour] ?? x?.settlement_hour ?? x?.hour ?? x?.h;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left p-2 text-xs uppercase tracking-wide muted">{labelHour}</th>
            <th className="text-right p-2 text-xs uppercase tracking-wide muted">{labelPrice}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = val(r);
            // simple color accent
            const min=150,max=900;
            const clamp = Math.max(min, Math.min(max, p||min));
            const ratio = (clamp-min)/(max-min);
            const hue = 210 - Math.round(ratio*210);
            const bg = `hsl(${hue} 70% 14% / 0.35)`;
            return (
              <tr key={i} style={{ background: (i%2)? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td className="p-2">{fmtH(hour(r))}</td>
                <td className="p-2 text-right">
                  <span className="px-2 py-1 rounded-lg border" style={{ borderColor: `hsl(${hue} 70% 30% / 0.6)`, background: bg }}>{isFinite(p) ? p.toFixed(0) : '-'}</span>
                </td>
              </tr>
            );
          })}
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
      <PageHeader title="Ceny energii" subtitle="Day‑Ahead (ENTSO‑E), RCE‑PLN (PSE) i RCEm" />
      <div className="container grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Day‑Ahead (ENTSO‑E)" subtitle="PLN/MWh">
          <div className="flex gap-2 mb-3">
            <input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
            <button onClick={loadDA} className="btn">Pobierz</button>
          </div>
          <VerticalTable rows={Array.isArray(da) ? da : []} accessorHour="ts" accessorPrice="price" />
        </Card>

        <Card title="RCE‑PLN (PSE)" subtitle="PLN/MWh">
          <div className="flex gap-2 mb-3">
            <input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
            <button onClick={loadRCE} className="btn">Pobierz</button>
          </div>
          <VerticalTable rows={Array.isArray(rce) ? rce : []} accessorHour="settlement_hour" accessorPrice="rce_pln" />
        </Card>

        <Card title="RCEm (miesięczna)" subtitle="PLN/MWh">
          <div className="flex gap-2 mb-3">
            <input className="input w-36" value={yyyymm} onChange={e=>setYyyymm(e.target.value)} placeholder="YYYY-MM" />
            <button onClick={loadRCEm} className="btn">Pobierz</button>
          </div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(rcem, null, 2)}</pre>
        </Card>
      </div>
    </main>
  );
}
