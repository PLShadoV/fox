import { useMemo } from 'react'

type Row = { ts: string; kwh: number; price: number; revenue: number }
type Props = {
  rows: Row[]
  range: { from: string; to: string }
  onRangeChange: (r: { from: string; to: string }) => void
}

export default function HourlyTable({ rows, range, onRangeChange }: Props) {
  const totals = useMemo(() => {
    return rows.reduce((acc, r) => {
      acc.kwh += r.kwh || 0
      acc.revenue += r.revenue || 0
      return acc
    }, { kwh: 0, revenue: 0 })
  }, [rows])

  return (
    <div className="rounded-2xl bg-slate-900/40 p-4 shadow">
      {/* Kontrolki dat przy tabeli */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-sm opacity-80 mb-1">Od</label>
          <input
            type="datetime-local"
            value={toLocal(range.from)}
            onChange={e => onRangeChange({ from: fromLocal(e.target.value), to: range.to })}
            className="bg-slate-800 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm opacity-80 mb-1">Do</label>
          <input
            type="datetime-local"
            value={toLocal(range.to)}
            onChange={e => onRangeChange({ from: range.from, to: fromLocal(e.target.value) })}
            className="bg-slate-800 rounded px-2 py-1"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left opacity-80">
            <tr><th>Godzina</th><th className="text-right">kWh</th><th className="text-right">Cena (PLN/kWh)</th><th className="text-right">Przychód (PLN)</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800/60">
                <td className="py-2">{fmtHour(r.ts)}</td>
                <td className="py-2 text-right">{fmt(r.kwh)}</td>
                <td className="py-2 text-right">{fmt(r.price)}</td>
                <td className="py-2 text-right">{fmt(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-700">
            <tr>
              <td className="py-2 font-semibold">Suma</td>
              <td className="py-2 text-right font-semibold">{fmt(totals.kwh)} kWh</td>
              <td></td>
              <td className="py-2 text-right font-semibold">{fmt(totals.revenue)} zł</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function fmt(n: number) { return (n ?? 0).toLocaleString('pl-PL', { maximumFractionDigits: 2 }) }
function fmtHour(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
function toLocal(iso: string) {
  const d = new Date(iso)
  const pad = (x: number) => String(x).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocal(local: string) {
  // traktujemy to jako czas lokalny i konstruujemy ISO
  const d = new Date(local)
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString()
}
