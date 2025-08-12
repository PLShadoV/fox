import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import { Bolt, ArrowDownLeft, ArrowUpRight, PiggyBank } from "lucide-react";
import ClientChart from "./price-chart";

export default async function DashboardPage() {
  return (
    <main className="container grid gap-6">
      <PageHeader title="Dashboard" subtitle="Podgląd mocy, przepływów i cen" />
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatTile label="Moc PV (W)" value={<span id="pvPower">—</span>} icon={<Bolt size={18} />} />
        <StatTile label="Eksport (W)" value={<span id="expW">—</span>} icon={<ArrowUpRight size={18} />} />
        <StatTile label="ArrowDownLeft (W)" value={<span id="impW">—</span>} icon={<ArrowDownLeft size={18} />} />
        <StatTile label="Zysk (dziś)" value={<span id="profit">—</span>} icon={<PiggyBank size={18} />} />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-lg font-semibold">Ceny Day‑Ahead</div>
              <div className="text-xs muted">ENTSO‑E → PLN/MWh</div>
            </div>
          </div>
          <ClientChart />
        </div>
        <div className="card">
          <div className="text-lg font-semibold mb-2">Szybki podgląd</div>
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span className="muted">PV teraz</span><span id="pv-inline">—</span></li>
            <li className="flex justify-between"><span className="muted">Eksport</span><span id="exp-inline">—</span></li>
            <li className="flex justify-between"><span className="muted">ArrowDownLeft</span><span id="imp-inline">—</span></li>
            <li className="hr"></li>
            <li className="flex justify-between"><span className="muted">Zysk dziś</span><span id="profit-inline">—</span></li>
          </ul>
        </div>
      </section>
      <script dangerouslySetInnerHTML={{__html: `
        (async function(){
          try {
            const inv = await fetch('/api/ingest/foxess?kind=realtime').then(r=>r.json());
            const profit = await fetch('/api/metrics/today').then(r=>r.json());
            const pv = inv?.pvPowerW ?? '—';
            const exp = inv?.gridArrowUpRightW ?? '—';
            const imp = inv?.gridArrowDownLeftW ?? '—';
            const prof = (profit?.netPLN ?? 0).toFixed ? (profit.netPLN).toFixed(2)+' PLN' : '—';
            document.getElementById('pvPower')!.textContent = pv;
            document.getElementById('expW')!.textContent = exp;
            document.getElementById('impW')!.textContent = imp;
            document.getElementById('profit')!.textContent = prof;
            document.getElementById('pv-inline')!.textContent = pv;
            document.getElementById('exp-inline')!.textContent = exp;
            document.getElementById('imp-inline')!.textContent = imp;
            document.getElementById('profit-inline')!.textContent = prof;
          } catch {}
        })();
      `}} />
    </main>
  );
}
