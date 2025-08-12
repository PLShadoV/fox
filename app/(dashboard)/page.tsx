import Tile from "@/components/ui/Tile";
import Card from "@/components/ui/Card";
import GaugeRing from "@/components/ui/GaugeRing";
import { Bolt, ArrowDownLeft, ArrowUpRight, PiggyBank } from "lucide-react";
import ClientChart from "./price-chart";

export default async function DashboardPage() {
  return (
    <main className="grid gap-6">
      <div>
        <div className="text-2xl font-semibold">Podgląd mocy, przepływów i cen</div>
        <div className="muted text-sm">Dane FoxESS + Tuya + ceny ENTSO‑E/PSE</div>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Tile title="Moc PV" value={<span id="pvPower">—</span>} icon={<Bolt size={18} />} hint="W" />
        <Tile title="Eksport" value={<span id="expW">—</span>} icon={<ArrowUpRight size={18} />} hint="W" />
        <Tile title="Import" value={<span id="impW">—</span>} icon={<ArrowDownLeft size={18} />} hint="W" />
        <Tile title="Zysk dziś" value={<span id="profit">—</span>} icon={<PiggyBank size={18} />} hint="PLN" />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
       <Card title="Ceny Day-Ahead">
  <p className="text-sm text-gray-500">ENTSO-E → PLN/MWh</p>

          <ClientChart />
        </Card>
        <Card title="Moc teraz">
          <div className="flex items-center justify-center"><GaugeRing value={0} suffix="kW" /></div>
        </Card>
      </section>
      <Card title="Szybki podgląd">
        <ul className="text-sm space-y-2">
          <li>• PV teraz — <span id="pv-inline">—</span></li>
          <li>• Eksport — <span id="exp-inline">—</span></li>
          <li>• Import — <span id="imp-inline">—</span></li>
          <li>• Zysk dziś — <span id="profit-inline">—</span></li>
        </ul>
      </Card>
      <script dangerouslySetInnerHTML={{__html: `
        (async function(){
          try {
            const inv = await fetch('/api/ingest/foxess?kind=realtime').then(r=>r.json());
            const profit = await fetch('/api/metrics/today').then(r=>r.json());
            const pv = inv?.pvPowerW ?? '—';
            const exp = inv?.gridExportW ?? '—';
            const imp = inv?.gridImportW ?? '—';
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
