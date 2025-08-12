// Landing page moved out of grouped segment to avoid ENOENT during tracing
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Link from "next/link";
import Card from "@/components/ui/Card";

export default async function HomePage() {
  return (
    <main className="min-h-screen p-6 md:p-10 bg-gradient-to-b from-[#0b1220] to-[#0a0f1a] text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">NetBilling • FoxESS</h1>
            <p className="muted text-sm md:text-base">Szybki dostęp do FoxESS, Tuya i cen (RCE/Day‑Ahead)</p>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <Link href="/foxess" className="btn btn-primary">FoxESS</Link>
            <Link href="/tuya" className="btn">Tuya</Link>
            <Link href="/prices" className="btn">Ceny</Link>
            <Link href="/history" className="btn">Historia</Link>
            <Link href="/diagnostics" className="btn">Diagnostyka</Link>
          </nav>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card title="Ceny Day‑Ahead" subtitle="ENTSO‑E → PLN/MWh">
            <div className="h-40 flex items-center justify-center text-white/70">
              (Wykres 24h — komponent klienta)
            </div>
          </Card>
          <Card title="Moc teraz">
            <div className="h-40 grid grid-cols-3 gap-3">
              <div className="tile">
                <div className="muted">PV</div>
                <div className="text-2xl font-semibold">—</div>
              </div>
              <div className="tile">
                <div className="muted">Import</div>
                <div className="text-2xl font-semibold">—</div>
              </div>
              <div className="tile">
                <div className="muted">Export</div>
                <div className="text-2xl font-semibold">—</div>
              </div>
            </div>
          </Card>
          <Card title="Szybkie akcje">
            <div className="flex flex-wrap gap-2">
              <Link href="/api/foxess/ping" className="btn btn-soft">Ping FoxESS</Link>
              <Link href="/api/ingest/foxess" className="btn btn-soft">Zapisz odczyt</Link>
              <Link href="/api/prices/da" className="btn btn-soft">Pobierz Day‑Ahead</Link>
              <Link href="/api/prices/rce-pln" className="btn btn-soft">Pobierz RCE</Link>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
