'use client'
import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import Tabs from '@/components/Tabs'
import TimeChart from '@/components/TimeChart'
import QuickRanges from '@/components/QuickRanges'
import { mergeAndCalcRevenue, sumRevenue, aggregate, type Aggregate } from '@/lib/calc'
import type { RevenuePoint } from '@/lib/types'

function formatPLN(n: number) { return n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) }
function fmtHour(iso: string) { const d = new Date(iso); return d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) }

export default function Page() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours() - 24); return d.toISOString() })
  const [to, setTo] = useState(() => new Date().toISOString())
  const [rows, setRows] = useState<RevenuePoint[]>([])
  const [agg, setAgg] = useState<Aggregate[]>([])
  const [gran, setGran] = useState<'hour' | 'day' | 'week' | 'month' | 'year'>('hour')
  const totals = useMemo(() => sumRevenue(rows), [rows])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [eRes, pRes] = await Promise.all([
        fetch(`/api/foxess?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        fetch(`/api/rce?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      ])
      if (!eRes.ok) throw new Error(await eRes.text())
      if (!pRes.ok) throw new Error(await pRes.text())
      const energy = await eRes.json()
      const prices = await pRes.json()
      const merged = mergeAndCalcRevenue(energy, prices)
      setRows(merged)
      setAgg(aggregate(merged, gran))
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania danych')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setAgg(aggregate(rows, gran)) }, [gran, rows])

  return (
    <main>
      <Card title="Podsumowanie" action={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Ładowanie…' : 'Odśwież'}</button>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-slate-300 text-sm mb-1">Oddane kWh (zakres)</div>
            <div className="stat">{totals.total_kwh} kWh</div>
          </div>
          <div className="card">
            <div className="text-slate-300 text-sm mb-1">Przychód (RCE)</div>
            <div className="stat">{formatPLN(totals.total_pln)}</div>
          </div>
          <div className="card">
            <div className="text-slate-300 text-sm mb-1">Zakres</div>
            <div className="stat"><span className="badge">od</span> {fmtHour(from)} <span className="badge ml-2">do</span> {fmtHour(to)}</div>
          </div>
        </div>
      </Card>

      <Card title="Szybkie zakresy">
        <QuickRanges onPick={(f,t)=>{ setFrom(f); setTo(t); }} />
      </Card>

      <Card title="Wykres przychodów">
        <div className="mb-4">
          <Tabs
            value={gran}
            onChange={(v) => setGran(v as any)}
            items={[
              { value: 'hour', label: 'Godziny' },
              { value: 'day', label: 'Dni' },
              { value: 'week', label: 'Tygodnie' },
              { value: 'month', label: 'Miesiące' },
              { value: 'year', label: 'Lata' },
            ]}
          />
        </div>
        <TimeChart data={agg.map(a => ({ x: a.label, y: a.revenue_pln }))} yLabel="Przychód [PLN]" />
      </Card>

      <Card title="Wykres energii (kWh)">
        <TimeChart data={agg.map(a => ({ x: a.label, y: a.exported_kwh }))} yLabel="Oddane [kWh]" />
      </Card>

      <Card title="Godzina po godzinie">
        {error && <div className="mb-3 text-red-300">{error}</div>}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Oddane [kWh]</th>
                <th>Cena [PLN/kWh]</th>
                <th>Przychód [PLN]</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.timestamp}>
                  <td className="whitespace-nowrap">{fmtHour(r.timestamp)}</td>
                  <td>{r.exported_kwh.toFixed(3)}</td>
                  <td>{r.price_pln_per_kwh.toFixed(4)}</td>
                  <td>{r.revenue_pln.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Ustawienia zakresu">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="sub">Od (ISO)</span>
            <input className="btn" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="sub">Do (ISO)</span>
            <input className="btn" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button className="btn" onClick={load} disabled={loading}>Przelicz</button>
          </div>
        </div>
      </Card>
    </main>
  )
}
