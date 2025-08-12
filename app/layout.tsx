import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import Sidebar from "@/components/ui/Sidebar";

export const metadata: Metadata = {
  title: "NetBilling • FoxESS",
  description: "PV & NetBilling dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
          <Sidebar />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
