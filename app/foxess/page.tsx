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
          <button onClick={load} className="btn btn-primary">Odśwież</button></div>}
        {loading ? <div className="skeleton h-32 rounded-xl" /> : <JsonTree data={data ?? {}} />}
      </Card>
    </main>
  );
}
