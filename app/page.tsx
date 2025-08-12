import StatTile from "@/components/ui/StatTile";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { Bolt, Import, Upload, PiggyBank } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pulpit</h1>
          <p className="text-sm text-slate-400">Szybki podgląd stanu instalacji</p>
        </div>
        <div className="flex gap-2">
          <Link href="/foxess" className="btn-primary">FoxESS</Link>
          <Link href="/prices" className="btn-ghost">Ceny RCE</Link>
          <Link href="/tuya" className="btn-ghost">Tuya</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Bolt} label="PV Power" value="—" suffix="W" />
        <StatTile icon={Upload} label="Wysył do sieci" value="—" suffix="W" />
        <StatTile icon={Import} label="Pobór z sieci" value="—" suffix="W" />
        <StatTile icon={PiggyBank} label="Dzisiejszy zarobek" value="—" suffix="PLN" />
      </div>

      <Card title="Szybkie działania">
        <div className="flex flex-wrap gap-3">
          <Link href="/foxess" className="btn-primary">Podgląd FoxESS</Link>
          <Link href="/prices" className="btn-ghost">Tabela cen RCE</Link>
          <Link href="/tuya" className="btn-ghost">Urządzenia Tuya</Link>
        </div>
      </Card>
    </main>
  );
}
