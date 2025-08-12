'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import { getBaseUrl } from '@/lib/base-url';

export default function FoxessPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const base = getBaseUrl(); // on client ''

  async function ping() {
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/foxess/ping`, { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } catch (e:any) {
      setData({ error: e?.message || 'fetch error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="FoxESS" subtitle="Szybki ping API" right={
        <button onClick={ping} disabled={loading} className="rounded-xl bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30 disabled:opacity-50">
          {loading ? 'Ładowanie…' : 'Odśwież'}
        </button>
      }>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/80">
          {data ? JSON.stringify(data, null, 2) : 'Kliknij „Odśwież”, aby wykonać ping.'}
        </pre>
      </Card>
    </div>
  );
}
