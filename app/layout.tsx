import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "FoxESS · RCE Dashboard",
  description: "Lekki, szybki dashboard do odczytu danych z FoxESS i RCE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="mx-auto max-w-6xl p-4">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
