import Card from "@/components/ui/Card";

export default function TuyaPage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tuya</h1>
          <p className="text-sm text-slate-400">Status licznika i urządzeń</p>
        </div>
        <a href="/api/tuya/device-status" target="_blank" className="btn-ghost">API status</a>
      </div>

      <Card title="Urządzenia">
        <div className="text-slate-300">Lista urządzeń (wkrótce)</div>
      </Card>
    </main>
  );
}
