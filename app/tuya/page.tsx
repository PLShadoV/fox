'use client';
import { useState } from 'react';

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

  const sendCommand = async () => {
    setLog('Wysyłam komendę włącz...');
    const r = await fetch('/api/control/tuya', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, dpCode: 'switch_1', value: true })
    });
    const j = await r.json();
    setLog(r.ok ? 'Komenda wysłana' : (j?.error || 'Błąd'));
  };

  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="font-semibold mb-2">Tuya / SmartLife</div>
        <div className="flex gap-2 items-center">
          <input className="px-2 py-1 bg-slate-800 rounded w-80" placeholder="deviceId" value={deviceId} onChange={e=>setDeviceId(e.target.value)} />
          <button onClick={readStatus} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Status</button>
          <button onClick={sendCommand} className="px-3 py-1 rounded bg-green-600 hover:bg-green-700">Włącz</button>
        </div>
        <div className="text-xs text-gray-400 mt-2">{log}</div>
      </div>
      <div className="card">
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(status, null, 2)}</pre>
      </div>
    </main>
  );
}
