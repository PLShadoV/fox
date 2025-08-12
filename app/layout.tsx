import Link from "next/link";

export const metadata = {
  title: "Net-Billing Dashboard",
  description: "FoxESS + Tuya + RCE/ENTSO-E"
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <div className="max-w-7xl mx-auto p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Net-Billing</h1>
            <nav className="flex gap-2 text-sm">
              <Link className="px-3 py-1 rounded bg-slate-700/40 hover:bg-slate-700/60" href="/">Dashboard</Link>
              <Link className="px-3 py-1 rounded bg-slate-700/40 hover:bg-slate-700/60" href="/foxess">FoxESS</Link>
              <Link className="px-3 py-1 rounded bg-slate-700/40 hover:bg-slate-700/60" href="/tuya">Tuya</Link>
              <Link className="px-3 py-1 rounded bg-slate-700/40 hover:bg-slate-700/60" href="/prices">Ceny</Link>
            </nav>
          </header>
          {children}
          <footer className="text-xs text-gray-500 py-6">Demo UI • zmodyfikuj w app/layout.tsx</footer>
        </div>
      </body>
    </html>
  );
}
