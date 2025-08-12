export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Card from "@/components/Card";

export default async function Page() {
  return (
    <main className="grid gap-4">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Ceny Day-Ahead" subtitle="ENTSO-E → PLN/MWh">
          <div className="muted text-sm">Tabela godzinowa pojawi się po integracji.</div>
        </Card>
        <Card title="Moc teraz">
          <div className="text-2xl">— kW</div>
          <div className="muted text-sm">PV / sieć / obciążenie</div>
        </Card>
        <Card title="Dzisiejszy wynik">
          <div className="text-2xl">— PLN</div>
          <div className="muted text-sm">Suma ProfitHour</div>
        </Card>
      </section>
    </main>
  );
}
