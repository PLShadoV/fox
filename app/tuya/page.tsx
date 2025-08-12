'use client';
import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import { PlugZap, RefreshCw, Power } from 'lucide-react';

export default function TuyaPage() {
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [log, setLog] = useState<string>('');

  const readStatus = async () => {
    setLog('Czytam status...');
    const r = await fetch('/api/tuya/device-status?deviceId=' + encodeURIComponent(deviceId));
    const j = await r.json();
    setStatus(j);
    setLog(r.ok ? 'OK' : (j?.error || 'Błąd'));
  };

  const sendCommand = async (value: boolean) => {
    setLog(`Wysyłam komendę ${value ? 'włącz' : 'wyłącz'}...`);
    const r = await fetch('/api/control/tuya', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, dpCode: 'switch_1', value })
    });
    const j = await r.json();
    setLog(r.ok ? 'Komenda wysłana' : (j?.error || 'Błąd'));
  };

  return (
    <main className="grid gap-4">
      <PageHeader title="Tuya / SmartLife" subtitle="Status i sterowanie urządzeniami" />
      <div className="container grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Urządzenie" subtitle="Podaj deviceId">
          <div className="flex gap-2">
            <input className="input w-full" placeholder="deviceId" value={deviceId} onChange={e=>setDeviceId(e.target.value)} />
            <button onClick={readStatus} className="btn"><RefreshCw size={16}/> Status</button>
            <button onClick={()=>sendCommand(true)} className="btn btn-primary"><Power size={16}/> Włącz</button>
          </div>
          <div className="text-xs muted mt-2">{log || 'Podaj deviceId i kliknij Status. Jeśli widzisz błąd tokena – ustaw TUYA_CLIENT_ID i TUYA_CLIENT_SECRET w Vercel → Environment Variables oraz połącz Tuya App Account w Tuya Cloud.'}</div>
        </Card>
        <Card title="Status DP">
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(status, null, 2)}</pre>
        </Card>
        <Card title="Wskazówki" subtitle="Jak zdobyć deviceId">
          <ul className="list-disc pl-5 text-sm space-y-2">
            <li>Połącz konto Smart Life w Tuya Cloud (Link App Account).</li>
            <li>Sprawdź listę urządzeń w projekcie – tam znajdziesz deviceId licznika.</li>
            <li>Wpisz deviceId powyżej i odczytaj status.</li>
          <li>Jeśli widzisz błąd <b>No permissions / subscription expired</b> – w Tuya Cloud wybierz zakładkę <b>Cloud</b> → <b>Subscribe</b> i aktywuj <i>Cloud Development</i> (bezpłatny plan próbny) oraz przyznaj uprawnienia <i>Device Status</i> i <i>Device Control</i>.</li></ul>
        </Card>
      </div>
    </main>
  );
}
