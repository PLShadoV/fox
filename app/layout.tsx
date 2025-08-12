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
            <h1 className="text-2xl font-semibold">Net‑Billing Dashboard</h1>
            <nav className="text-sm text-gray-400">Demo start</nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
