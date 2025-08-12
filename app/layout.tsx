// app/layout.tsx
import './globals.css'; // ← TO JEST KLUCZOWE!

export const metadata = {
  title: 'Net-Billing',
  description: 'FoxESS • Tuya • Ceny',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh bg-[#0e1117] text-white antialiased">
// wewnątrz <body>...
<nav className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
  <a href="/" className="font-semibold">Net-Billing</a>
  <div className="flex gap-2 text-sm">
    <a className="btn" href="/foxess">FoxESS</a>
    <a className="btn" href="/tuya">Tuya</a>
    <a className="btn" href="/prices">Ceny</a>
    <a className="btn" href="/history">Historia</a>
  </div>
</nav>

        <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
      </body>
    </html>
  );
}
