// app/api/data/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion: string[] = ['waw1', 'fra1', 'arn1'];

const TZ = 'Europe/Warsaw';

type HourRow = {
  timestamp: string;            // ISO (początek godziny – odpowiada lokalnej PL)
  exported_kwh: number;         // z FoxESS
  rce_pln_per_kwh?: number;     // z RCE (PLN/kWh)
  revenue_pln?: number;         // exported_kwh * rce_pln_per_kwh
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

function parseRange(req: NextRequest): { fromISO: string; toISO: string; info: string } {
  const { searchParams } = new URL(req.url);
  const fromQ = searchParams.get('from');
  const toQ = searchParams.get('to');
  const dateQ = searchParams.get('date') || searchParams.get('day') || searchParams.get('d');
  const rangeQ = (searchParams.get('range') || '').toLowerCase(); // 'today' | 'yesterday'

  if (fromQ && toQ) {
    return { fromISO: new Date(fromQ).toISOString(), toISO: new Date(toQ).toISOString(), info: 'from/to' };
  }

  if (dateQ) {
    // YYYY-MM-DD w czasie PL
    const [y, m, d] = dateQ.split('-').map((n) => Number(n));
    const fromISO = isoForWarsawHour(y, (m || 1) - 1, d || 1, 0);
    const toISO = isoForWarsawHour(y, (m || 1) - 1, (d || 1) + 1, 0);
    return { fromISO, toISO, info: 'date/day' };
  }

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

  // Zakres: today vs yesterday (w strefie PL)
  const mid = new Date(Date.UTC(Y, M - 1, D, 12));
  if (rangeQ === 'yesterday' || !rangeQ) {
    mid.setUTCDate(mid.getUTCDate() - 1);
  }
  Y = mid.getUTCFullYear();
  M = mid.getUTCMonth() + 1;
  D = mid.getUTCDate();

  const fromISO = isoForWarsawHour(Y, M - 1, D, 0);
  const toISO = isoForWarsawHour(Y, M - 1, D + 1, 0);
  return { fromISO, toISO, info: rangeQ || 'yesterday(default)' };
}

async function tryImport(paths: string[]) {
  for (const p of paths) {
    try {
      // @ts-ignore dynamic
      const mod = await import(p);
      if (mod) return mod;
    } catch (_) {}
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { fromISO, toISO, info } = parseRange(req);

  const errors: Record<string, string> = {};
  let foxess: Array<{ timestamp: string; exported_kwh: number }> = [];
  let rce: Array<{ timestamp: string; price_pln_mwh?: number; pln_per_kwh?: number }> = [];

  // FOXESS – szukamy providera w 2 miejscach
  try {
    const foxMod =
      (await tryImport(['@/lib/providers/foxess', '@/lib/foxess'])) || null;
    if (!foxMod) {
      throw new Error('Nie znaleziono modułu FOXESS (oczekiwano "@/lib/providers/foxess" lub "@/lib/foxess").');
    }
    const fn =
      foxMod.fetchFoxEssHourlyExported ||
      foxMod.fetchFoxessHourlyExported ||
      foxMod.default;
    if (typeof fn !== 'function') {
      throw new Error('Moduł FOXESS nie eksportuje funkcji fetchFoxEssHourlyExported.');
    }
    foxess = await fn(fromISO, toISO);
  } catch (e: any) {
    errors.foxess = e?.message || String(e);
  }

  // RCE – spróbuj kilku ścieżek i nazw
  try {
    const rceMod =
      (await tryImport([
        '@/lib/providers/rce',
        '@/lib/rce',
        '@/lib/providers/pse',
        '@/lib/providers/rce-pln',
      ])) || null;

    let rceFn: any = null;
    if (rceMod) {
      rceFn =
        rceMod.fetchRceHourlyPln ||
        rceMod.fetchRCEHourlyPLN ||
        rceMod.fetchRCE ||
        rceMod.default;
    }
    if (typeof rceFn === 'function') {
      rce = await rceFn(fromISO, toISO);
    } else {
      // Ostatnia próba: jeśli masz wewnętrzny endpoint /api/rce
      try {
        const url = new URL('/api/rce', req.url);
        url.searchParams.set('from', fromISO);
        url.searchParams.set('to', toISO);
        const res = await fetch(url.toString(), { next: { revalidate: 60 } });
        if (res.ok) {
          rce = await res.json();
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        throw new Error(
          'Nie znaleziono providera RCE. Dodaj "@/lib/providers/rce" (eksportujący fetchRceHourlyPln(fromISO,toISO)) albo utwórz endpoint /api/rce.'
        );
      }
    }
  } catch (e: any) {
    errors.rce = e?.message || String(e);
  }

  // Mapowanie do wspólnej tabeli godzinowej
  const map = new Map<string, HourRow>();
  for (const p of foxess) {
    const ts = String(p.timestamp);
    map.set(ts, { timestamp: ts, exported_kwh: Number(p.exported_kwh) || 0 });
  }
  for (const p of rce) {
    const ts = String(p.timestamp);
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

  // Posortowane
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
        range: { fromISO, toISO, parsedBy: info },
        hourly,
        totals: {
          exported_kwh: Number(totals.exported_kwh.toFixed(6)),
          revenue_pln: Number(totals.revenue_pln.toFixed(6)),
        },
        // surowe dane też zwracamy — ułatwia to frontowi wykresy i debug
        foxessRaw: foxess,
        rceRaw: rce,
        errors: Object.keys(errors).length ? errors : undefined,
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json' } }
  );
}
