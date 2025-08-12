// Strona główna – ma być SSR/dynamic, bez prerenderingu i bez edge.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel domowy</h1>
          <p className="text-sm text-white/70">FoxESS • Tuya • Ceny RCE/Day-Ahead</p>
        </div>
        <nav className="flex gap-2">
          <Link className="btn" href="/foxess">FoxESS</Link>
          <Link className="btn" href="/tuya">Tuya</Link>
          <Link className="btn" href="/prices">Ceny</Link>
          <Link className="btn" href="/diagnostics">Diagnostyka</Link>
          <Link className="btn" href="/history">Historia</Link>
        </nav>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card-glass p-5">
          <div className="text-sm font-medium text-white/80">Szybkie akcje</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/api/foxess/ping" className="btn btn-primary text-center">Ping FoxESS</Link>
            <Link href="/api/cron/run" className="btn text-center">Wymuś CRON</Link>
          </div>
        </div>

        <div className="card-glass p-5">
          <div className="text-sm font-medium text-white/80">Źródła</div>
          <ul className="mt-3 list-disc pl-5 text-sm text-white/70 space-y-1">
            <li>FoxESS: token prywatny / OAuth</li>
            <li>Tuya: Cloud project + deviceId</li>
            <li>Ceny: RCE / Day-Ahead</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
