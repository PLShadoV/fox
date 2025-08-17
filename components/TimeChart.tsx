'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

type Point = { ts: string; kwh: number }
type Props = { data: Point[]; title?: string }

export default function TimeChart({ data, title = 'Wykres energii (kWh)' }: Props) {
  const yMax = Math.max(0, ...data.map(d => Number(d.kwh) || 0))
  const domainMax = yMax > 0 ? +(yMax * 1.1).toFixed(2) : 1

  return (
    <div className="rounded-2xl bg-slate-900/40 p-4 shadow">
      <div className="text-lg font-semibold mb-3">{title}</div>
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={data}>
          <CartesianGrid strokeOpacity={0.15} />
          <XAxis
            dataKey="ts"
            minTickGap={28}
            tickFormatter={(v: string) =>
              new Date(v).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
            }
          />
          <YAxis
            domain={[0, domainMax]}
            tickFormatter={(v: number) => v.toLocaleString('pl-PL')}
          />
          <Tooltip
            labelFormatter={(v: any) => new Date(v).toLocaleString('pl-PL')}
            formatter={(val: any) => [
              `${Number(val).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} kWh`,
              'Energia',
            ]}
          />
          <Area type="monotone" dataKey="kwh" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
