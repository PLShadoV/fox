'use client'
import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Chart({ data }: { data: any[] }) {
  return (
    <div className="card">
      <div className="h2 mb-3">Godzina po godzinie</div>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hh" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Line yAxisId="left" type="monotone" dataKey="exportKwh" name="Oddane (kWh)" dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="pvKwh" name="PV (kWh)" dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="importKwh" name="Pobrane (kWh)" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="price" name="RCE (PLN/kWh)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
