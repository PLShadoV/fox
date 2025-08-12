// Strona główna dashboardu: dynamiczny runtime, bez prerenderingu
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import dynamic from 'next/dynamic';
import Card from '@/components/ui/Card';

const ClientChart = dynamic(() => import('./price-chart'), { ssr: false });

export default async function DashboardPage() {
  return (
    <main className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">Podgląd</div>
          <div className="text-sm text-white/60">Szybkie wykresy i metryki</div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Ceny Day‑Ahead" subtitle="ENTSO‑E → PLN/MWh">
          <ClientChart />
        </Card>

        <Card title="FoxESS – moc teraz" subtitle="PV / eksport / import">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-semibold">—</div>
              <div className="muted text-xs">PV</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">—</div>
              <div className="muted text-xs">Eksport</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">—</div>
              <div className="muted text-xs">Import</div>
            </div>
          </div>
        </Card>

        <Card title="Net Billing – dziś" subtitle="Suma przychodu [PLN]">
          <div className="text-3xl font-semibold">—</div>
          <div className="muted text-xs mt-1">na podstawie zapisanych godzin</div>
        </Card>
      </section>
    </main>
  );
}
