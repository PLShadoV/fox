'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import { Calendar, Download } from 'lucide-react';

export default function PricesPage() {
  const [date, setDate] = useState<string>('today');
  const [da, setDa] = useState<any[]>([]);
  const [rcem, setRcem] = useState<any|null>(null);
  const [yyyymm, setYyyymm] = useState<string>('2025-08');

  const loadDA = async () => {
    const r = await fetch('/api/prices/da?date=' + encodeURIComponent(date));
    setDa(await r.json());
  };
  const loadRCEm = async () => {
    const r = await fetch('/api/prices/rcem?yyyymm=' + encodeURIComponent(yyyymm));
    setRcem(await r.json());
  };

  useEffect(() => { loadDA(); }, []);

  return (
    <main className="grid gap-4">
      <PageHeader title="Ceny energii" subtitle="Day‑Ahead (ENTSO‑E) i RCEm (PSE/OIRE)" />
      <div className="container grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Day‑Ahead" subtitle="Cena godzinowa" right={
          <div className="flex items-center gap-2">
            <input className="input w-44" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
            <button onClick={loadDA} className="btn"><Calendar size={16}/> Pobierz</button>
          </div>
        }>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(da, null, 2)}</pre>
        </Card>

        <Card title="RCEm" subtitle="Cena miesięczna" right={
          <div className="flex items-center gap-2">
            <input className="input w-36" value={yyyymm} onChange={e=>setYyyymm(e.target.value)} placeholder="YYYY-MM" />
            <button onClick={loadRCEm} className="btn"><Download size={16}/> Pobierz</button>
          </div>
        }>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(rcem, null, 2)}</pre>
        </Card>
      </div>
    </main>
  );
}
