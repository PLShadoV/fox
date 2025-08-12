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
        <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
      </body>
    </html>
  );
}
