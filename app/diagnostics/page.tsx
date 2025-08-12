'use client';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import JsonTree from '@/components/ui/JsonTree';

export default function DiagnosticsPage(){
  const [health, setHealth] = useState<any>(null);
  const [dry, setDry] = useState<any>(null);
  return (
    <main className="grid gap-6">
      <div>
        <div className="text-2xl font-semibold">Diagnostyka</div>
        <div className="muted text-sm">Szybkie testy backendu i podpisów FoxESS</div>
      </div>
      <Card title="Health">
        <div className="flex gap-2 mb-3">
          <button className="btn btn-primary" onClick={async()=> setHealth(await (await fetch('/api/health')).json())}>Sprawdź /api/health</button>
        </div>
        {health && <JsonTree data={health} />}
      </Card>
      <Card title="FoxESS dry‑run (szukanie działającego podpisu)">
        <div className="flex gap-2 mb-3">
          <button className="btn" onClick={async()=> setDry(await (await fetch('/api/debug/foxess-dryrun')).json())}>Start</button>
        </div>
        {dry && <JsonTree data={dry} />}
      </Card>
    </main>
  );
}
