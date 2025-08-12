'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { hour: string; price: number };

export default function ClientChart() {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/prices/dayahead?zone=PL&currency=PLN', { cache: 'no-store' });
        if (!res.ok) throw new Error('prices api failed');
        const json = await res.json();
        const rows = (json?.hours || []).map((r: any) => ({ hour: r.time || r.hour, price: Number(r.price) }));
        if (!cancelled) setData(rows);
      } catch {
        // fallback demo data (nie blokuje buildu)
        const demo = Array.from({ length: 24 }).map((_, i) => ({
          hour: String(i).padStart(2, '0') + ':00',
          price: 200 + Math.round(60 * Math.sin(i / 3)),
        }));
        if (!cancelled) setData(demo);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      {loading && <div className="text-xs text-white/50 mt-2">Ładowanie cen...</div>}
    </div>
  );
}
