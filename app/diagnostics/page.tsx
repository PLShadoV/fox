import Card from "@/components/Card";

async function getRealtime() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/foxess/realtime`, { cache: "no-store" });
  return res.json();
}

export default async function Diagnostics() {
  const rt = await getRealtime();
  return (
    <main className="grid gap-4">
      <Card title="FoxESS realtime – raw">
        <pre className="overflow-auto rounded-xl bg-black/40 p-3 text-xs">
{JSON.stringify(rt, null, 2)}
        </pre>
      </Card>
    </main>
  );
}
