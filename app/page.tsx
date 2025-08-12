'use client'
import React from "react";
import dayjs from "dayjs";
import Header from "@/components/Header";
import Kpi from "@/components/Kpi";
import Chart from "@/components/LineChart";
import { mergeByHour, revenueForPeriod } from "@/lib/calc";
import { RangeKey } from "@/components/RangeChips";

type ApiFox = { date?: string; start?: string; end?: string; data: { time: string; exportKwh: number; importKwh: number; pvKwh: number }[] };
type ApiRce = { date?: string; start?: string; end?: string; data: { time: string; price: number }[] };

function aggregateByDay(rows: any[]) {
  const byDay: Record<string, { exportKwh:number; importKwh:number; pvKwh:number; revenue:number; priceSum:number; priceCount:number; }> = {};
  for (const r of rows) {
    const d = r.time.slice(0,10);
    if (!byDay[d]) byDay[d] = { exportKwh:0, importKwh:0, pvKwh:0, revenue:0, priceSum:0, priceCount:0 };
    byDay[d].exportKwh += r.exportKwh;
    byDay[d].importKwh += r.importKwh;
    byDay[d].pvKwh += r.pvKwh;
    if (typeof r.price === "number") {
      byDay[d].revenue += r.exportKwh * r.price;
      byDay[d].priceSum += r.price;
      byDay[d].priceCount += 1;
    }
  }
  return Object.entries(byDay).map(([date, v]) => ({
    date,
    exportKwh: v.exportKwh,
    importKwh: v.importKwh,
    pvKwh: v.pvKwh,
    revenue: v.revenue,
    avgPrice: v.priceCount ? (v.priceSum / v.priceCount) : 0
  })).sort((a,b)=> a.date.localeCompare(b.date));
}

export default function Page() {
  const [date, setDate] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [range, setRange] = React.useState<RangeKey>("today");
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<any[]>([]);
  const [kpis, setKpis] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [monthTable, setMonthTable] = React.useState<any[]>([]);

  async function loadDay(d: string) {
    const [fRes, rRes] = await Promise.all([
      fetch(`/api/foxess?date=${d}`),
      fetch(`/api/rce?date=${d}`),
    ]);
    const f: ApiFox = await fRes.json();
    const r: ApiRce = await rRes.json();
    if ((f as any).error) throw new Error((f as any).error);
    if ((r as any).error) throw new Error((r as any).error);

    const merged = mergeByHour(
      f.data.map(x => ({ time: x.time, exportKwh: x.exportKwh, importKwh: x.importKwh, pvKwh: x.pvKwh })),
      r.data.map(x => ({ time: x.time, price: x.price }))
    );
    const { revenue, exported, imported, pv, avgPrice } = revenueForPeriod(merged);

    const table = merged.map(m => ({
      hh: dayjs(m.time).format("HH"),
      exportKwh: m.exportKwh,
      importKwh: m.importKwh,
      pvKwh: m.pvKwh,
      price: m.price,
      revenue: m.price != null ? (m.exportKwh * (m.price as number)) : null,
      time: m.time,
    }));
    setRows(table);
    setKpis({ revenue, exported, imported, pv, avgPrice });
    setMonthTable([]);
  }

  async function loadMonth(d: string) {
    const monthStart = dayjs(d).startOf("month").format("YYYY-MM-DD");
    const monthEnd = dayjs(d).endOf("month").format("YYYY-MM-DD");
    const [fRes, rRes] = await Promise.all([
      fetch(`/api/foxess?start=${monthStart}&end=${monthEnd}`),
      fetch(`/api/rce/range?start=${monthStart}&end=${monthEnd}`),
    ]);
    const f: ApiFox = await fRes.json();
    const r: ApiRce = await rRes.json();
    if ((f as any).error) throw new Error((f as any).error);
    if ((r as any).error) throw new Error((r as any).error);

    // Merge hour-by-hour across whole month
    const fx = f.data.map(x => ({ time: x.time, exportKwh: x.exportKwh, importKwh: x.importKwh, pvKwh: x.pvKwh }));
    const rc = r.data.map(x => ({ time: x.time, price: x.price }));
    // Join by timestamp; naive map first
    const priceMap = new Map(rc.map(x => [x.time, x.price]));
    const merged = fx.map(m => ({ ...m, price: priceMap.get(m.time) ?? null }));

    const days = aggregateByDay(merged);
    const totals = days.reduce((acc, d) => ({
      revenue: acc.revenue + d.revenue,
      exported: acc.exported + d.exportKwh,
      imported: acc.imported + d.importKwh,
      pv: acc.pv + d.pvKwh,
      priceSum: acc.priceSum + d.avgPrice,
      priceCount: acc.priceCount + 1
    }), { revenue:0, exported:0, imported:0, pv:0, priceSum:0, priceCount:0 });

    setKpis({
      revenue: totals.revenue,
      exported: totals.exported,
      imported: totals.imported,
      pv: totals.pv,
      avgPrice: totals.priceCount ? (totals.priceSum / totals.priceCount) : 0
    });
    setMonthTable(days);
    setRows([]);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (range === "month") {
        await loadMonth(date);
      } else {
        await loadDay(date);
      }
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load() }, [date, range]);

  return (
    <div>
      <Header date={date} setDate={setDate} range={range} setRange={setRange} />
      {error ? (
        <div className="card border border-red-200">Błąd: {error}</div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label={range==="month" ? "Przychód (miesiąc)" : "Przychód (dzień)"} value={kpis ? kpis.revenue.toFixed(2) : (loading ? "…" : "0.00")} suffix="PLN" sub={kpis ? `Śr. RCE: ${kpis.avgPrice.toFixed(3)} PLN/kWh` : ""} />
        <Kpi label="Oddane do sieci" value={kpis ? kpis.exported.toFixed(2) : (loading ? "…" : "0.00")} suffix="kWh" sub={range==="month" ? "Suma miesiąca" : "Suma godzinowa"} />
        <Kpi label="Pobrane z sieci" value={kpis ? kpis.imported.toFixed(2) : (loading ? "…" : "0.00")} suffix="kWh" />
        <Kpi label="Produkcja PV" value={kpis ? kpis.pv.toFixed(2) : (loading ? "…" : "0.00")} suffix="kWh" />
      </div>

      {range !== "month" ? (
        <div className="mt-5">
          <Chart data={rows} />
        </div>
      ) : (
        <div className="card mt-5">
          <div className="h2 mb-3">Dni miesiąca</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Oddane (kWh)</th>
                  <th className="py-2 pr-4">Pobrane (kWh)</th>
                  <th className="py-2 pr-4">PV (kWh)</th>
                  <th className="py-2 pr-4">Śr. RCE</th>
                  <th className="py-2 pr-4">Przychód (PLN)</th>
                </tr>
              </thead>
              <tbody>
                {monthTable.map((d:any) => (
                  <tr key={d.date} className="border-t">
                    <td className="py-2 pr-4">{d.date}</td>
                    <td className="py-2 pr-4">{d.exportKwh.toFixed(2)}</td>
                    <td className="py-2 pr-4">{d.importKwh.toFixed(2)}</td>
                    <td className="py-2 pr-4">{d.pvKwh.toFixed(2)}</td>
                    <td className="py-2 pr-4">{d.avgPrice.toFixed(3)}</td>
                    <td className="py-2 pr-4">{d.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card mt-5 text-sm text-gray-600">
        <div className="font-medium mb-2">Uwagi</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Przychód = suma(oddane_kWh * RCE_PLN/kWh).</li>
          <li>"Dzisiaj", "Wczoraj" – przełącza szybki zakres. "Miesiąc" sumuje każdy dzień bieżącego miesiąca.</li>
          <li>Jeśli API FoxESS zwraca inny format, dopasuj mapowanie w <code>lib/foxess.ts</code> (funkcja <code>mapFoxessHourly</code>).</li>
        </ul>
      </div>
    </div>
  );
}
