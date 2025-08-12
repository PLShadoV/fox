'use client';
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { getBaseUrl } from "@/lib/base-url";

export default function FoxessPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ping() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/foxess/ping`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Błąd");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { ping(); }, []);

  return (
    <main className="grid gap-4">
      <Card title="FoxESS">
        <div className="muted text-sm mb-2">Test połączenia z API</div>
        <button className="btn btn-primary" onClick={ping} disabled={loading}>
          {loading ? "Ładuję..." : "Połącz / Odśwież"}
        </button>
        <pre className="mt-3 overflow-auto rounded-xl bg-black/30 p-3 text-xs">
{JSON.stringify(data ?? { status: "no data" }, null, 2)}
        </pre>
        {error ? <div className="text-red-300 mt-2">{error}</div> : null}
      </Card>
    </main>
  );
}
