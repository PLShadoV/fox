import './globals.css';
import Nav from '@/components/Nav';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FoxESS Dashboard',
  description: 'Minimal UI scaffold',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh bg-[#0e1117] text-white antialiased">
        <div className="mx-auto max-w-6xl p-4">
          <Nav />
          <main className="mt-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
