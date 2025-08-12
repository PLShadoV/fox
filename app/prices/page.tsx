'use client';
import { useEffect, useState } from 'react';

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
      <div className="card flex items-center justify-between">
        <div>
          <div className="font-semibold">Ceny – Day-Ahead (ENTSO-E)</div>
          <div className="text-xs text-gray-400">PL strefa rynkowa</div>
        </div>
        <div className="flex gap-2">
          <input className="px-2 py-1 bg-slate-800 rounded" value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD lub 'today'" />
          <button onClick={loadDA} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Pobierz</button>
        </div>
      </div>
      <div className="card"><pre className="text-xs">{JSON.stringify(da, null, 2)}</pre></div>

      <div className="card flex items-center justify-between">
        <div>
          <div className="font-semibold">RCEm – Miesięczna cena rynkowa</div>
          <div className="text-xs text-gray-400">Źródło: PSE/OIRE lub ENV</div>
        </div>
        <div className="flex gap-2">
          <input className="px-2 py-1 bg-slate-800 rounded" value={yyyymm} onChange={e=>setYyyymm(e.target.value)} placeholder="YYYY-MM" />
          <button onClick={loadRCEm} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Pobierz</button>
        </div>
      </div>
      <div className="card"><pre className="text-xs">{JSON.stringify(rcem, null, 2)}</pre></div>
    </main>
  );
}
