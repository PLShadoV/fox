'use client'

import { useEffect, useMemo, useState } from 'react'
import QuickRanges from '@/components/QuickRanges'
import TimeChart from '@/components/TimeChart'

type Row = {
  ts: string   // ISO
  kwh: number  // oddane kWh (godz.)
  price?: number
  revenue?: number
}

export default function Page() {
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    // start i koniec DZISIAJ wg czasu lokalnego -> wysyłamy .toISOString() (bez ręcznego offsetu)
    const now = new Date()
    const from = new Date(now); from.setHours(0, 0, 0, 0)
    const to = new Date(now);   to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  })
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState<{ pv_w: number; feedin_w: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 👉 AUTO-FETCH po zmianie zakresu
  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/data?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!ignore) {
          const list: Row[] = (json.rows ?? json.data ?? []).map((r: any) => ({
            ts: r.ts ?? r.timestamp,
            kwh: Number(r.kwh ?? r.exported_kwh ?? 0),
            price: Number(r.price ?? r.rce_pln ?? 0),
            revenue: Number(r.revenue ?? r.income ?? (Number(r.kwh ?? r.exported_kwh ?? 0) * Number(r.price ?? r.rce_pln ?? 0))),
          }))
          setRows(list)
        }
      } catch (e: any) {
        if (!ignore) { setRows([]); setError(e?.message || 'Błąd pobierania danych') }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [range.from, range.to])

 // fragment w app/page.tsx – hook od live:
useEffect(() => {
  let stop = false
  async function tick() {
    try {
      const res = await fetch('/api/foxess/live', { cache: 'no-store' })
      const json = await res.json()
      if (!stop && json?.ok) setLive({ pv_w: json.pv_w, feedin_w: json.feedin_w })
    } catch {}
    if (!stop) setTimeout(tick, 60_000) // 60 sekund
  }
  tick()
  return () => { stop = true }
}, [])


  const totals = useMemo(() => ({
    kwh: rows.reduce((s, r) => s + (Number(r.kwh) || 0), 0),
    revenue: rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0),
  }), [rows])

  const todaySoFar = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('pl-PL')
    const cutHour = now.getHours()
    return rows.reduce((s, r) => {
      const d = new Date(r.ts)
      if (d.toLocaleDateString('pl-PL') !== todayStr) return s
      return s + (d.getHours() < cutHour ? (Number(r.kwh) || 0) : 0)
    }, 0)
  }, [rows])

  return (
    <main className="p-4 md:p-6 space-y-6">
      {/* Kafelki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Oddane kWh (zakres)"><Big>{fmt(totals.kwh, 1)} kWh</Big></Card>
        <Card title="Przychód (RCE)"><Big>{fmt(totals.revenue, 2)} zł</Big></Card>
        <Card title="Obecna moc (PV)"><Big>{live ? `${Math.round(live.pv_w).toLocaleString('pl-PL')} W` : '—'}</Big></Card>
        <Card title="Dziś do tej pory"><Big>{fmt(todaySoFar, 2)} kWh</Big></Card>
      </div>

      {/* Presety zakresów */}
      <QuickRanges value={range} onChange={setRange} className="mb-2" />

      {/* Tabela z kontrolkami dat */}
      <div className="rounded-2xl bg-slate-900/40 p-4 shadow">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="block text-sm opacity-80 mb-1">Od</label>
            <input
              type="datetime-local"
              value={toLocalInput(range.from)}
              onChange={e => setRange(r => ({ ...r, from: fromLocalInput(e.target.value) }))}
              className="bg-slate-800 rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm opacity-80 mb-1">Do</label>
            <input
              type="datetime-local"
              value={toLocalInput(range.to)}
              onChange={e => setRange(r => ({ ...r, to: fromLocalInput(e.target.value) }))}
              className="bg-slate-800 rounded px-2 py-1"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-80">
              <tr><th className="py-2">Godzina</th><th className="py-2 text-right">kWh</th><th className="py-2 text-right">Cena (PLN/kWh)</th><th className="py-2 text-right">Przychód (PLN)</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-800/60">
                  <td className="py-2">{fmtHour(r.ts)}</td>
                  <td className="py-2 text-right">{fmt(r.kwh, 3)}</td>
                  <td className="py-2 text-right">{fmt(r.price ?? 0, 3)}</td>
                  <td className="py-2 text-right">{fmt(r.revenue ?? 0, 2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-700">
              <tr>
                <td className="py-2 font-semibold">Suma</td>
                <td className="py-2 text-right font-semibold">{fmt(totals.kwh, 2)} kWh</td>
                <td></td>
                <td className="py-2 text-right font-semibold">{fmt(totals.revenue, 2)} zł</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {loading && <div className="opacity-70 mt-3">Ładowanie…</div>}
        {error && <div className="text-red-400 mt-2">Błąd: {error}</div>}
      </div>

      {/* Wykres kWh */}
      <TimeChart data={rows.map(r => ({ ts: r.ts, kwh: Number(r.kwh || 0) }))} />
    </main>
  )
}

/* ————— helpers ————— */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-900/40 p-4 shadow"><div className="opacity-80 text-sm">{title}</div>{children}</div>
}
function Big({ children }: { children: React.ReactNode }) {
  return <div className="text-3xl font-semibold mt-1">{children}</div>
}
function fmt(n: number, frac = 2) { return (n ?? 0).toLocaleString('pl-PL', { maximumFractionDigits: frac }) }
function fmtHour(ts: string) { return new Date(ts).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(localValue: string) {
  // ✅ tu też: Date interpretuje string jako „czas lokalny” – samo .toISOString() wystarczy
  return new Date(localValue).toISOString()
}
