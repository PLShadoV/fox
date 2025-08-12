import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "FoxESS NetBilling",
  description: "Dashboard inspirowany FoxESS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
