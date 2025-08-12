'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';

type Row = { id:string; ts:string; pvPowerW:number; gridExportW:number; gridImportW:number; batterySOC:number|null };

export default function HistoryPage(){
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => setRows(await fetch('/api/history/recent').then(r=>r.json()));
  const store = async () => { await fetch('/api/ingest/foxess?store=1'); await load(); };
  useEffect(()=>{ load(); }, []);
  return (
    <main className="grid gap-6">
      <div>
        <div className="text-2xl font-semibold">Historia</div>
        <div className="muted text-sm">Ostatnie odczyty z falownika (manual store)</div>
      </div>
      <Card right={<div className="flex gap-2"><button className="btn" onClick={load}>Odśwież</button><button className="btn btn-primary" onClick={store}>Zapisz teraz</button></div>}>
        <div className="overflow-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-2">Czas</th>
                <th className="text-right p-2">PV [W]</th>
                <th className="text-right p-2">Eksport [W]</th>
                <th className="text-right p-2">Import [W]</th>
                <th className="text-right p-2">SOC [%]</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r)=> (
                <tr key={r.id} style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td className="p-2">{new Date(r.ts).toLocaleString()}</td>
                  <td className="p-2 text-right">{r.pvPowerW}</td>
                  <td className="p-2 text-right">{r.gridExportW}</td>
                  <td className="p-2 text-right">{r.gridImportW}</td>
                  <td className="p-2 text-right">{r.batterySOC ?? '-'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-2" colSpan={5}>Brak danych — kliknij „Zapisz teraz”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
