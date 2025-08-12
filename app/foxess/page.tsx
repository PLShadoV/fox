export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Card from '@/components/ui/Card';

async function getRealtime() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/foxess/ping`, { cache: 'no-store' });
  try { return await res.json(); } catch { return null; }
}

export default async function FoxessPage() {
  const data = await getRealtime();
  const sample = data?.sample ?? {};
  const pv = Number(sample.pvPowerW ?? 0);
  const exportW = Number(sample.gridExportW ?? 0);
  const importW = Number(sample.gridImportW ?? 0);

  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FoxESS</h1>
          <p className="muted text-sm">Stan inwertera i telemetrii</p>
        </div>
        <a href="/api/foxess/ping" className="btn btn-primary">Test ping</a>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="PV Power">
          <div className="stat">{pv.toFixed(0)}<span className="k"> W</span></div>
        </Card>
        <Card title="Feed-in (eksport)">
          <div className="stat">{exportW.toFixed(0)}<span className="k"> W</span></div>
        </Card>
        <Card title="Import">
          <div className="stat">{importW.toFixed(0)}<span className="k"> W</span></div>
        </Card>
        <Card title="Battery SoC">
          <div className="stat">—<span className="k"> %</span></div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Surowe dane">
          <pre className="max-h-[420px] overflow-auto text-xs leading-relaxed">
            {JSON.stringify(data?.raw ?? data, null, 2)}
          </pre>
        </Card>
        <Card title="Skróty">
          <div className="grid grid-cols-2 gap-2">
            <a className="btn" href="/api/ingest/foxess">Zapisz odczyt</a>
            <a className="btn" href="/diagnostics">Diagnostyka</a>
            <a className="btn" href="/prices">Ceny</a>
            <a className="btn" href="/history">Historia</a>
          </div>
        </Card>
      </section>
    </main>
  );
}
