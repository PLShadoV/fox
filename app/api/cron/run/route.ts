import { NextResponse } from "next/server";

export const runtime = 'edge';

/**
 * Single cron for Vercel Free plan.
 * - Hourly ingest FoxESS realtime (lightweight snapshot)
 * - Hourly fetch ENTSO-E day-ahead (only once per day, server-side cached in DB in a real impl)
 * - Hourly poll Tuya meter (if TUYA_METER_ID is set, comma-separated)
 * - Quickly return (keep < 60s)
 * This is intentionally idempotent and safe to call multiple times.
 */
export async function GET() {
  const tasks: Promise<any>[] = [];
  tasks.push(fetch(new URL('/api/ingest/foxess', process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000') + '?kind=realtime').then(r=>r.json()).catch(()=>({})));
  tasks.push(fetch(new URL('/api/prices/da', process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000') + '?date=today').then(r=>r.json()).catch(()=>({})));

  const ids = (process.env.TUYA_METER_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const id of ids) {
    tasks.push(fetch(new URL('/api/ingest/tuya', process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000') + `?deviceId=${encodeURIComponent(id)}&kind=meter`).then(r=>r.json()).catch(()=>({})));
  }

  const results = await Promise.all(tasks);
  return NextResponse.json({ ok: true, results });
}
