import Card from "@/components/Card";
import Stat from "@/components/Stat";
import PriceChart from "./price-chart";
import PowerChart from "./power-chart";

async function getRealtime() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/foxess/realtime`, { cache: "no-store" });
  return res.json();
}
async function getPrices() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/prices/rce`, { next: { revalidate: 300 } });
  return res.json();
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const [{ ok, pvPowerW, gridExportW, gridImportW, todayYieldKWh } = {} as any, prices] = await Promise.all([getRealtime(), getPrices()]);
  return (
    <main className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Moc teraz" subtitle="Dane z falownika">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="PV" value={pvPowerW ?? "—"} unit="W" />
          <Stat label="Eksport" value={gridExportW ?? "—"} unit="W" />
          <Stat label="Import" value={gridImportW ?? "—"} unit="W" />
        </div>
      </Card>

      <Card title="Produkcja dziś" subtitle="KWh">
        <div className="text-3xl font-semibold">{todayYieldKWh ?? "—"} <span className="text-base text-white/60">kWh</span></div>
      </Card>

      <Card title="Ceny energii (RCE)" subtitle="PLN/MWh">
        <PriceChart data={prices?.data ?? []} />
      </Card>

      <div className="lg:col-span-3">
        <Card title="Wykres mocy (demo)" subtitle="PV / siatka">
          <PowerChart />
        </Card>
      </div>
    </main>
  );
}
