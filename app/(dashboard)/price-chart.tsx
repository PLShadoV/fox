'use client';
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Point = { ts: string; price: number; };
export default function ClientChart() {
  const [data, setData] = useState<Point[]>([]);
  useEffect(() => {
    fetch('/api/prices/da?date=today').then(r => r.json()).then(setData).catch(()=>{});
  }, []);
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="price" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
