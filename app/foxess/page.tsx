/* eslint-disable */
// @ts-nocheck
'use client';
import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Tile from '@/components/ui/Tile';
import JsonTree from '@/components/ui/JsonTree';
import { RefreshCw, BatteryCharging, ArrowDownLeft, ArrowUpRight, Bolt, PlugZap } from 'lucide-react';

export default function FoxessPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(undefined);
  const [ping, setPing] = useState<any>(null);
  const [pinging, setPinging] = useState(false);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch('/api/ingest/foxess');
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Błąd FoxESS');
      setData(j);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function testPing(){
    setPinging(true);
    try {
      const res = await fetch('/api/foxess/ping', { cache: 'no-store' });
      const j = await res.json();
      setPing({ status: res.status, body: j });
    } catch (e:any) {
      setPing({ status: 0, body: { ok:false, error: e?.message || String(e) } });
    } finally {
      setPinging(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">FoxESS</div>
          <div className="muted text-sm">Dane w czasie rzeczywistym (Private Token)</div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-primary"><RefreshCw size={16}/> Odśwież</button>
          <a href="/api/foxess/ping" target="_blank" rel="noreferrer" className="btn">/api/foxess/ping</a>
          <button onClick={testPing} className="btn"><PlugZap size={16}/> Test ping</button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Tile title="PV"      value={loading ? '…' : (data?.pvPowerW ?? '—')}      icon={<Bolt size={18}/>}           hint="W" />
        <Tile title="Eksport" value={loading ? '…' : (data?.gridExportW ?? '—')}   icon={<ArrowUpRight size={18}/>}   hint="W" />
        <Tile title="Import"  value={loading ? '…' : (data?.gridImportW ?? '—')}   icon={<ArrowDownLeft size={18}/>}  hint="W" />
        <Tile title="SOC"     value={loading ? '…' : (data?.batterySOC ?? '—')}    icon={<BatteryCharging size={18}/>} hint="%" />
      </section>

      <Card title="Szczegóły">
        {error
          ? <div className="mb-3 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm">{error}</div>
          : (loading ? <div className="skeleton h-32 rounded-xl" /> : <JsonTree data={data ?? {}} />)
        }
      </Card>

      <Card title="Ping API">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={testPing} disabled={pinging} className="btn btn-primary">
            {pinging ? 'Pinguję…' : 'Ping'}
          </button>
          <span className="muted text-sm">Otwórz w nowej karcie lub sprawdź wynik poniżej.</span>
        </div>
        {ping && <JsonTree data={ping} />}
      </Card>
    </main>
  );
}
