'use client';
import { useEffect, useState } from 'react';

export default function FoxessPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string|undefined>();

  const load = async () => {
    setError(undefined);
    try {
      const r = await fetch('/api/ingest/foxess?kind=realtime');
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Błąd FoxESS');
      setData(j);
    } catch (e:any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="grid gap-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">FoxESS – Realtime</div>
          <div className="text-sm text-gray-400">Podgląd mocy i przepływów</div>
        </div>
        <button onClick={load} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Odśwież</button>
      </div>
      <div className="card">
        {error && <div className="text-red-400">{error}</div>}
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </main>
  );
}
