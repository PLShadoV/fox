import Card from "@/components/ui/Card";

async function fetchPrices() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/prices/rce`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch { return []; }
}

export default async function PricesPage() {
  const items = await fetchPrices();
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ceny RCE</h1>
          <p className="text-sm text-slate-400">Taryfy godzinowe (PLN/MWh lub PLN/kWh)</p>
        </div>
        <a href="/api/prices/rce" target="_blank" className="btn-ghost">API</a>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Godzina</th><th>Cena</th></tr>
            </thead>
            <tbody>
              {items.map((row:any, i:number) => (
                <tr key={i}>
                  <td className="text-slate-300">{row.hour || row.ts || `#${i+1}`}</td>
                  <td>{row.price != null ? row.price : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
