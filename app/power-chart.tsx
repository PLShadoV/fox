"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

type Realtime = { pvPowerW?: number; gridExportW?: number; gridImportW?: number };

export default function PowerChart() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/foxess/realtime", { cache: "no-store" });
        const j: any = await res.json();
        const point = {
          t: new Date().toLocaleTimeString(),
          pv: j?.pvPowerW ?? 0,
          export: j?.gridExportW ?? 0,
          import: j?.gridImportW ?? 0,
        };
        setData(d => [...d.slice(-59), point]); // keep last 60 points
      } catch {}
      if (!stop) setTimeout(tick, 5000);
    }
    tick();
    return () => { stop = true; };
  }, []);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="t" hide />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="pv" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="export" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="import" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
