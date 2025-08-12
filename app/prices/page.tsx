'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';

function VTable({ rows, hourKey, priceKey }:{ rows:any[], hourKey:string, priceKey:string }){
  if (!Array.isArray(rows) || !rows.length) return <div className="muted text-sm">Brak danych</div>;
  const normHour = (v:any)=> {
    const s = String(v ?? '');
    return s.includes(':') ? s : String(v).padStart(2,'0') + ':00';
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left p-2 text-xs uppercase tracking-wide">Godzina</th>
            <th className="text-right p-2 text-xs uppercase tracking-wide">PLN/MWh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>{
            const h = r?.[hourKey] ?? r?.settlement_hour ?? r?.hour ?? i;
            const p = Number(r?.[priceKey] ?? r?.rce_pln ?? r?.price);
            return (
              <tr key={i} style={{ background: (i%2)? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td className="p-2">{normHour(h)}</td>
                <td className="p-2 text-right"><span className="badge">{isFinite(p)? p.toFixed(0): '-'}</span></td>
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

  useEffect(() => { (async()=>{
    setDa(await fetch('/api/prices/da?date=' + encodeURIComponent(date)).then(r=>r.json()));
    setRce(await fetch('/api/prices/rce-pln?date=' + encodeURIComponent(date)).then(r=>r.json()));
  })(); }, []);

  return (
    <main className="grid gap-6">
      <div>
        <div className="text-2xl font-semibold">Ceny</div>
        <div className="muted text-sm">Day‑Ahead (ENTSO‑E) i RCE‑PLN (PSE)</div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Day‑Ahead (ENTSO‑E)" right={<div className="flex gap-2"><input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} /><button className="btn" onClick={async()=>setDa(await fetch('/api/prices/da?date='+encodeURIComponent(date)).then(r=>r.json()))}>Pobierz</button></div>}>
          <VTable rows={da} hourKey="ts" priceKey="price" />
        </Card>
        <Card title="RCE‑PLN (PSE)" right={<div className="flex gap-2"><input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} /><button className="btn" onClick={async()=>setRce(await fetch('/api/prices/rce-pln?date='+encodeURIComponent(date)).then(r=>r.json()))}>Pobierz</button></div>}>
          <VTable rows={rce} hourKey="settlement_hour" priceKey="rce_pln" />
        </Card>
      </section>
    </main>
  );
}


function RCEmCard(){
  const [yyyymm, setYyyymm] = useState<string>(new Date().toISOString().slice(0,7));
  const [res, setRes] = useState<any>(null);
  const fetchRCEm = async ()=> setRes(await fetch('/api/prices/rcem?yyyymm='+encodeURIComponent(yyyymm)).then(r=>r.json()));
  useEffect(()=>{ fetchRCEm(); }, []);
  return (
    <Card title="RCEm (miesięczna)">
      <div className="flex gap-2 mb-3">
        <input className="input w-40" value={yyyymm} onChange={e=>setYyyymm(e.target.value)} />
        <button className="btn" onClick={fetchRCEm}>Pobierz</button>
      </div>
      {res ? <div className="text-sm">
        <div><b>Miesiąc:</b> {res.yyyymm}</div>
        <div><b>Średnia:</b> {res.average ?? '-'} PLN/MWh</div>
        <div><b>Min/Max:</b> {res.min ?? '-'} / {res.max ?? '-'}</div>
        <div className="muted text-xs mt-2">Wyliczone z godzinowych RCE-PLN w danym miesiącu.</div>
      </div> : <div className="muted text-sm">Brak</div>}
    </Card>
  );
}
