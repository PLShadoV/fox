'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Tile from '@/components/ui/Tile';
import JsonTree from '@/components/ui/JsonTree';
import { RefreshCw, BatteryCharging, ArrowDownLeft, ArrowUpRight, Bolt, Link as LinkIcon } from 'lucide-react';

export default function FoxessPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [connected, setConnected] = useState<boolean>(false);
  const [reason, setReason] = useState<string|undefined>();

  const load = async () => {
    setError(undefined); setLoading(true);
    try {
      const r = await fetch('/api/ingest/foxess?kind=realtime');
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Błąd FoxESS');
      setData(j);
    } catch (e:any) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { (async()=>{
    const s = await fetch('/api/foxess/status').then(r=>r.json());
    setConnected(!!s.connected); setReason(s.reason);
  })(); }, []);

  return (
    <main className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">FoxESS</div>
          <div className="muted text-sm">Dane w czasie rzeczywistym (Cloud API)</div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-primary"><RefreshCw size={16}/> Odśwież</button>
          {!connected && <a className="btn" href="/api/foxess/login"><LinkIcon size={16}/> Połącz</a>}
        </div>
      </div>

      {!connected && (
        <Card title="Połącz FoxESS" subtitle="Uwierzytelnij dostęp przez OAuth (bezpieczniej niż token prywatny)">
          <p className="text-sm">Status: <span className="badge">niepołączone</span> {reason && <span className="muted">({reason})</span>}</p>
          <div className="mt-3"><a className="btn btn-primary" href="/api/foxess/login"><LinkIcon size={16}/> Zaloguj i udziel dostępu</a></div>
        </Card>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Tile title="PV" value={data?.pvPowerW ?? (loading?'…':'—')} icon={<Bolt size={18} />} hint="W" />
        <Tile title="Eksport" value={data?.gridExportW ?? (loading?'…':'—')} icon={<ArrowUpRight size={18} />} hint="W" />
        <Tile title="Import" value={data?.gridImportW ?? (loading?'…':'—')} icon={<ArrowDownLeft size={18} />} hint="W" />
        <Tile title="SOC" value={data?.batterySOC ?? (loading?'…':'—')} icon={<BatteryCharging size={18} />} hint="%" />
      </section>

      <Card title="Szczegóły">
        {error && <div className="mb-3 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm">{error}</div>}
        {loading ? <div className="skeleton h-32 rounded-xl" /> : <JsonTree data={data ?? {}} />}
      </Card>
    </main>
  );
}
