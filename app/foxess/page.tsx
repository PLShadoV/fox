'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tile from '@/components/ui/Tile';
import { RefreshCw, BatteryCharging, ArrowDownLeft, ArrowUpRight, Bolt } from 'lucide-react';

export default function FoxessPage() {
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

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
  useEffect(() => { (async()=>{ const s = await fetch('/api/foxess/status').then(r=>r.json()); setConnected(!!s.connected); setExpiresAt(s.expiresAt || undefined); })(); load(); }, []);

  return (
    <main className="grid gap-4">
      <PageHeader title="FoxESS" subtitle="Dane w czasie rzeczywistym (Cloud API)"
        actions={<button onClick={load} className="btn btn-primary"><RefreshCw size={16}/> Odśwież</button>} />
      <div className="container grid gap-6">
        {!connected && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Połącz konto FoxESS</div>
                <div className="text-sm muted">Użyj OAuth, aby bezpiecznie udostępnić dane</div>
              </div>
              <a className="btn btn-primary" href="/api/foxess/login">Połącz</a>
            </div>
          </div>
        )}
        {error && <div className="mb-3 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm">{error}</div>}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Tile title="PV" value={data?.pvPowerW ?? '—'} icon={<Bolt size={18} />} hint="W" />
          <Tile title="Eksport" value={data?.gridExportW ?? '—'} icon={<ArrowUpRight size={18} />} hint="W" />
          <Tile title="Import" value={data?.gridImportW ?? '—'} icon={<ArrowDownLeft size={18} />} hint="W" />
          <Tile title="SOC" value={data?.batterySOC ?? '—'} icon={<BatteryCharging size={18} />} hint="%" />
        </section>
        <Card title="Szczegóły (raw)">
          <details className="text-sm">
            <summary className="cursor-pointer mb-2">Pokaż JSON</summary>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data?.raw ?? data, null, 2)}</pre>
          </details>
          {data?.raw?.errno === 40256 && (
            <div className="mt-3 text-sm">
              <div className="mb-1">⚠️ <b>Illegal signature</b> – wygląda na różnice w podpisie/regionie konta.</div>
              <ul className="list-disc pl-5">
                <li>Upewnij się, że masz aktywne **Open API** w FoxESS Cloud i używasz **API Key**, nie loginu/hasła.</li>
                <li>Sprawdź w ENV: <code>FOXESS_API_BASE=https://www.foxesscloud.com</code> i poprawny **SN**.</li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
