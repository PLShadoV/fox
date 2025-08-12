import Card from "@/components/ui/Card";

export const dynamic = "force-dynamic";

async function fetchPing() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/foxess/ping`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function Tile({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="card-glass p-5">
      <div className="text-sm/5 text-white/70">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">
        {value}{suffix ? <span className="ml-1 text-white/60 text-lg">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default async function FoxessPage() {
  const data = await fetchPing();
  const pv = data?.sample?.pvPowerW ?? 0;
  const exp = data?.sample?.gridExportW ?? 0;
  const imp = data?.sample?.gridImportW ?? 0;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FoxESS</h1>
          <p className="text-sm text-slate-400">Stan inwertera i telemetry</p>
        </div>
        <a href="/api/foxess/ping" target="_blank" className="btn-primary">Test ping</a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="PV Power" value={pv} suffix="W" />
        <Tile label="Feed-in" value={exp} suffix="W" />
        <Tile label="Import" value={imp} suffix="W" />
        <Tile label="Battery SoC" value="—" suffix="%" />
      </div>

      <Card title="Surowe dane">
        <pre className="max-h-[420px] overflow-auto text-xs text-slate-200">
{JSON.stringify(data?.raw ?? data, null, 2)}
        </pre>
      </Card>
    </main>
  );
}
