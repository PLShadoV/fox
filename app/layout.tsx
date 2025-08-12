import Sidebar from "@/components/ui/Sidebar";

export const metadata = {
  title: "Net-Billing Dashboard",
  description: "FoxESS + Tuya + RCE/ENTSO-E"
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="app">
          <Sidebar />
          <div className="main">
            {children}
            <footer>© {new Date().getFullYear()} Net‑Billing • Demo</footer>
          </div>
        </div>
      </body>
    </html>
  );
}
