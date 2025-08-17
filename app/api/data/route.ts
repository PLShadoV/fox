// app/api/data/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// ✅ ważne: zwykła tablica stringów (bez `as const`)
export const preferredRegion: string[] = ['waw1', 'fra1', 'arn1'];

const TZ = 'Europe/Warsaw';

type HourRow = {
  timestamp: string;
  exported_kwh: number;
  rce_pln_per_kwh?: number;
  revenue_pln?: number;
};

function isoForWarsawHour(y: number, m1: number, d: number, h: number) {
  const seed = new Date(Date.UTC(y, m1, d, h));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(seed);
  const Y = Number(parts.find((p) => p.type === 'year')!.value);
  const M = Number(parts.find((p) => p.type === 'month')!.value);
  const D = Number(parts.find((p) => p.type === 'day')!.value);
  const H = Number(parts.find((p) => p.type === 'hour')!.value);
  const warsawAsUTC = new Date(Date.UTC(Y, M - 1, D, H, 0, 0));
  return warsawAsUTC.toISOString();
}

function parseRange(req: NextRequest): { fromISO: string; toISO: string } {
  const { searchParams } = new URL(req.url);
  const fromQ = searchParams.get('from');
  const toQ = searchParams.get('to');

  if (fromQ && toQ) return { fromISO: new Date(fromQ).toISOString(), toISO: new Date(toQ).toISOString() };

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  let Y = Number(parts.find((p) => p.type === 'year')!.value);
  let M = Number(parts.find((p) => p.type === 'month')!.value);
  let D = Number(parts.find((p) => p.type === 'day')!.value);
  const dLocal = new Date(Date.UTC(Y, M - 1, D, 12));
  dLocal.setUTCDate(dLocal.getUTCDate() - 1);
  Y = dLocal.getUTCFullYear();
  M = dLocal.getUTCMonth() + 1;
  D = dLocal.getUTCDate();

  const fromISO = isoForWarsawHour(Y, M - 1, D, 0);
  const toISO = isoForWarsawHour(Y, M - 1, D + 1, 0);
  return { fromISO, toISO };
}

export async function GET(req: NextRequest) {
  const { fromISO, toISO } = parseRange(req);

  const errors: Record<string, string> = {};
  let foxess: Array<{ timestamp: string; exported_kwh: number }> = [];
  let rce: Array<{ timestamp: string; price_pln_mwh?: number; pln_per_kwh?: number }> = [];

  // FOXESS
  try {
    const mod = await import('@/lib/providers/foxess');
    const { fetchFoxEssHourlyExported } = mod as any;
    foxess = await fetchFoxEssHourlyExported(fromISO, toISO);
  } catch (e: any) {
    errors.foxess = e?.message || String(e);
  }

  // RCE (opcjonalnie)
  try {
    // @ts-ignore – provider może nie istnieć
    const rceMod = await import('@/lib/providers/rce').catch(() => null as any);
    if (rceMod) {
      const fn =
        rceMod.fetchRceHourlyPln ||
        rceMod.fetchRCEHourlyPLN ||
        rceMod.fetchRCE ||
        rceMod.default;
      if (typeof fn === 'function') {
        rce = await fn(fromISO, toISO);
      }
    }
  } catch (e: any) {
    errors.rce = e?.message || String(e);
  }

  const map = new Map<string, HourRow>();
  for (const p of foxess) {
    map.set(p.timestamp, { timestamp: p.timestamp, exported_kwh: Number(p.exported_kwh) || 0 });
  }
  for (const p of rce) {
    const ts = p.timestamp;
    const row = map.get(ts) || { timestamp: ts, exported_kwh: 0 };
    const plnPerKwh =
      typeof p.pln_per_kwh === 'number'
        ? p.pln_per_kwh
        : typeof p.price_pln_mwh === 'number'
        ? p.price_pln_mwh / 1000
        : undefined;
    if (typeof plnPerKwh === 'number') {
      row.rce_pln_per_kwh = plnPerKwh;
      row.revenue_pln = Number((row.exported_kwh * plnPerKwh).toFixed(6));
    }
    map.set(ts, row);
  }

  const hourly = Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const totals = hourly.reduce(
    (acc, r) => {
      acc.exported_kwh += r.exported_kwh || 0;
      acc.revenue_pln += r.revenue_pln || 0;
      return acc;
    },
    { exported_kwh: 0, revenue_pln: 0 }
  );

  return new Response(
    JSON.stringify(
      {
        ok: true,
        range: { fromISO, toISO },
        hourly,
        totals: {
          exported_kwh: Number(totals.exported_kwh.toFixed(6)),
          revenue_pln: Number(totals.revenue_pln.toFixed(6)),
        },
        errors: Object.keys(errors).length ? errors : undefined,
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json' } }
  );
}
