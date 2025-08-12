"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PriceChart({ data }: { data: { ts: string; pricePLN: number }[] }) {
  if (!Array.isArray(data) || data.length === 0) return <div className="muted">Brak danych cen.</div>;
  const short = data.map(d => ({ ...d, hour: d.ts.slice(11,16) || d.ts }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={short}>
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="pricePLN" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
