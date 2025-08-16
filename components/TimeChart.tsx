'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
export type SeriesPoint = { x: string; y: number }
export default function TimeChart({ data, yLabel }:{ data: SeriesPoint[]; yLabel: string }){
  return <div style={{ width:'100%', height:320 }}>
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top:10, right:20, left:0, bottom:10 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="x" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} width={60} />
        <Tooltip formatter={(v:any)=> typeof v==='number'? v.toLocaleString('pl-PL'): v} labelFormatter={(l)=>`${l}`} />
        <Area type="monotone" dataKey="y" strokeOpacity={0.8} fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
