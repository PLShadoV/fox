'use client';
import { useEffect, useState } from "react";

type Tile = { label: string; value: string; };
export default function SummaryTiles() {
  const [tiles, setTiles] = useState<Tile[]>([
    { label: 'Moc PV (W)', value: '—' },
    { label: 'Eksport (W)', value: '—' },
    { label: 'Import (W)', value: '—' },
    { label: 'Zysk (dziś)', value: '—' },
  ]);
  useEffect(() => {
    (async () => {
      try {
        const [inv, profit] = await Promise.all([
          fetch('/api/ingest/foxess?kind=realtime').then(r=>r.json()),
          fetch('/api/metrics/today').then(r=>r.json())
        ]);
        setTiles([
          { label: 'Moc PV (W)', value: String(inv?.pvPowerW ?? '—') },
          { label: 'Eksport (W)', value: String(inv?.gridExportW ?? '—') },
          { label: 'Import (W)', value: String(inv?.gridImportW ?? '—') },
          { label: 'Zysk (dziś)', value: profit?.netPLN?.toFixed?.(2) + ' PLN' ?? '—' },
        ]);
      } catch {}
    })();
  }, []);
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="card">
          <div className="text-xs text-gray-400">{t.label}</div>
          <div className="text-xl font-semibold">{t.value}</div>
        </div>
      ))}
    </section>
  );
}
