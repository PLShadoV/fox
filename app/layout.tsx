import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Net-Billing',
  description: 'Podgląd FoxESS / Tuya / Ceny',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh bg-[#0e1117] text-white antialiased">
        {/* Główny navbar */}
        <nav className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur">
          <a href="/" className="font-semibold tracking-tight">Net-Billing</a>
          <div className="flex gap-2 text-sm">
            <a className="btn" href="/foxess">FoxESS</a>
            <a className="btn" href="/tuya">Tuya</a>
            <a className="btn" href="/prices">Ceny</a>
            <a className="btn" href="/history">Historia</a>
          </div>
        </nav>

        <div className="mx-auto max-w-6xl px-4 pb-12">
          {children}
        </div>
      </body>
    </html>
  );
}
