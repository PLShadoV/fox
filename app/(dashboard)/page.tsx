// Strona główna: wymuszamy dynamikę (bez SSG) i zwykły runtime node
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from "next/link";
import Card from "@/components/ui/Card";

export default async function DashboardPage() {
  return (
    <main className="container mx-auto p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-semibold text-white/90">Panel energii</h1>
        <p className="text-white/60 mt-1">FoxESS • Tuya • Ceny RCE (Day-Ahead)</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card title="FoxESS" subtitle="Połącz i podgląd danych" right={
          <Link href="/foxess" className="btn btn-primary">Otwórz</Link>
        }>
          <div className="text-sm text-white/70">
            Podgląd mocy PV, poboru/zrzutu do sieci, SOC itp.
          </div>
        </Card>

        <Card title="Tuya" subtitle="Licznik 3-fazowy" right={
          <Link href="/tuya" className="btn">Otwórz</Link>
        }>
          <div className="text-sm text-white/70">
            Status urządzenia i komendy sterujące (jeśli skonfigurowane).
          </div>
        </Card>

        <Card title="Ceny RCE" subtitle="Day-Ahead PLN/MWh" right={
          <Link href="/prices" className="btn">Dzisiejsza tabela</Link>
        }>
          <div className="text-sm text-white/70">
            Godzinowy wykres i tabela cen — źródło ENTSO-E/PSE.
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card title="Historia" subtitle="Odczyty i zapisy (DB)" right={
          <Link href="/history" className="btn">Otwórz</Link>
        }>
          <div className="text-sm text-white/70">
            Podgląd ostatnich odczytów i zapis manualny.
          </div>
        </Card>

        <Card title="Diagnostyka" subtitle="API & środowisko" right={
          <Link href="/diagnostics" className="btn">Otwórz</Link>
        }>
          <div className="text-sm text-white/70">
            Szybkie testy /api oraz zmienne środowiskowe.
          </div>
        </Card>
      </section>
    </main>
  );
}
