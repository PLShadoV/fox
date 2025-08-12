import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FoxESS → RCE | Zarobek",
  description: "Czytaj FoxESS i RCE, licz przychód (net-billing).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="container py-6">{children}</div>
      </body>
    </html>
  );
}
