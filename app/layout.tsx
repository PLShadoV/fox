import Navbar from "@/components/ui/Navbar";

export const metadata = {
  title: "Net-Billing Dashboard",
  description: "FoxESS + Tuya + RCE/ENTSO-E"
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <Navbar />
        {children}
        <footer className="container text-xs muted py-8">© {new Date().getFullYear()} Net‑Billing • Demo</footer>
      </body>
    </html>
  );
}
