'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import { RefreshCw } from 'lucide-react';

export default function FoxessPage() {
  const [data, setData] = useState<any>(null);
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
  useEffect(() => { load(); }, []);

  return (
    <main className="grid gap-4">
      <PageHeader title="FoxESS" subtitle="Dane w czasie rzeczywistym (Cloud API)" actions={
        <button onClick={load} className="btn btn-primary"><RefreshCw size={16}/> Odśwież</button>
      } />
      <div className="container grid gap-4">
        <Card title="Realtime" subtitle="PV / Import / Eksport">
          {error && <div className="mb-3 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm">{error}</div>}
          {loading && <div className="muted">Ładowanie…</div>}
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </Card>
      </div>
    </main>
  );
}
