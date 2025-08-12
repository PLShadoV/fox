/* eslint-disable */
// @ts-nocheck

import crypto from "crypto";

const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";
const TZ = process.env.FOXESS_TIMEZONE || "Europe/Warsaw";

export type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

// ---------- próba użycia foxess-lib (różne wersje mają różne exports) ----------
async function tryFoxessLib(): Promise<any[] | null> {
  if (!TOKEN || !SN) return null;
  let lib: any = null;
  try {
    // najpierw główny export
    lib = require("foxess-lib");
  } catch {
    return null;
  }

  try {
    // wariant 1: klient
    if (typeof lib.createClient === "function") {
      const client = lib.createClient({
        baseUrl: BASE,
        auth: { type: "private", token: TOKEN },
        timezone: TZ,
        fetchOptions: { cache: "no-store" },
      });
      const res = await client.device.real.query({ sn: SN, variables: [] });
      const result = (res as any)?.result ?? res;
      const arr = Array.isArray(result) ? result : (result?.datas || result?.data || []);
      return arr || [];
    }
    // wariant 2: bezpośrednia funkcja getRealTimeData
    if (typeof lib.getRealTimeData === "function") {
      const result = await lib.getRealTimeData(TOKEN, { sn: SN });
      return Array.isArray(result) ? result : [];
    }
    // wariant 3: namespaced inverter.getRealTimeData
    const inv = (lib.inverter || lib.default?.inverter);
    if (inv && typeof inv.getRealTimeData === "function") {
      const result = await inv.getRealTimeData(TOKEN, { sn: SN });
      return Array.isArray(result) ? result : [];
    }
  } catch {
    // jeżeli któraś wersja „nie leży” – lecimy fallbackiem
  }
  return null;
}

// ---------- fallback: nasz podpis z timeoutem i wariantami ----------
function md5Hex(x:string, upper=false){ const h=crypto.createHash('md5').update(x).digest('hex'); return upper? h.toUpperCase(): h; }
function guessOffset(tz:string){
  try {
    const fmt = new Intl.DateTimeFormat('pl-PL', { timeZone: tz, timeZoneName: 'shortOffset' });
    const p = fmt.formatToParts(new Date());
    const off = p.find(x=>x.type==='timeZoneName')?.value || '+01:00';
    return off.replace('UTC','').replace('GMT','').trim();
  } catch { return '+01:00'; }
}
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(new Error('Timeout')), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(t); }
}
async function signedFetch(path: string, method: "GET" | "POST", bodyObj: any, { perAttemptMs=3000, maxAttempts=36 } = {}){
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
  const bodyHash = md5Hex(bodyStr);
  const baseTs = Date.now();
  const skews = [0, 10_000, -10_000, 60_000, -60_000];
  const units: Array<'ms'|'sec'> = ['ms','sec'];
  const tsKeys = ['timestamp','timeStamp'];
  const tzKeys = ['timezone','timeZone','tz'];
  const tzValues = [TZ, guessOffset(TZ)];
  const pathVars = Array.from(new Set([ path, path.endsWith('/')? path.slice(0,-1) : path+'/', path.replace(/\/+$/,'') ]));
  const signBases = (p:string, tok:string, t:string) => [
    `${p}\r\n${tok}\r\n${t}`,
    `${p}\n${tok}\n${t}`,
    `${p}${tok}${t}`,
    `${p}\r\n${tok}\r\n${t}\r\n${bodyHash}`,
    `${p}\n${tok}\n${t}\n${bodyHash}`,
  ];

  let last:any=null, attempts=0;
  for (const p of pathVars){
    for (const skew of skews){
      for (const unit of units){
        const tsVal = unit==='ms' ? String(baseTs+skew) : String(Math.floor((baseTs+skew)/1000));
        for (const tkey of tsKeys){
          for (const tzKey of tzKeys){
            for (const tzVal of tzValues){
              for (const upper of [false,true]){
                for (const base of signBases(p, TOKEN, tsVal)){
                  attempts++; if (attempts>maxAttempts) return last ?? { data:null, debug:{ note:"maxAttempts reached" } };
                  const sig = md5Hex(base, upper);
                  const headers: Record<string,string> = {
                    "token": TOKEN, [tkey]: tsVal, "signature": sig, "lang":"en",
                    [tzKey]: tzVal,
                    "Accept":"application/json", "Content-Type":"application/json",
                    "Accept-Language":"en-US,en;q=0.9",
                    "Origin":"https://www.foxesscloud.com", "Referer":"https://www.foxesscloud.com/"
                  };
                  try {
                    const res = await fetchWithTimeout(BASE + p, { method, headers, body: bodyStr || undefined, cache: "no-store" }, perAttemptMs);
                    let data:any=null; try { data=await res.json(); } catch { data=await res.text(); }
                    last = { data, debug: { p, tkey, unit, skew, upper, tzKey, tzVal, status: res.status, attempts } };
                    if (typeof data==='object' && (data?.errno===40256 || String(data?.msg||'').toLowerCase().includes('illegal'))) { continue; }
                    if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}: ${JSON.stringify(data)}`);
                    return last;
                  } catch (e:any) {
                    last = { error: e?.message || String(e), debug: { p, tkey, unit, skew, upper, tzKey, tzVal, attempts } };
                    continue;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return last;
}

function mapRealtime(raw:any): Realtime {
  const result = raw?.result || {};
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : (result.datas || result.data || []);
  const g = (name:string)=> arr.find(x=> x.variable?.toLowerCase()===name.toLowerCase())?.value;
  const pvPowerW = Number(g('pvPower') ?? g('pv1Power') ?? g('ppv') ?? 0);
  const feedin   = Number(g('feedinPower') ?? g('feedin') ?? 0);
  const gridCons = Number(g('gridConsumptionPower') ?? g('gridConsumption') ?? 0);
  const socRaw   = g('SoC') ?? g('soc') ?? g('batterySoC') ?? g('batterysoc');
  const batterySOC = typeof socRaw === 'number' ? socRaw : undefined;
  return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw };
}

export async function getFoxRealtime(): Promise<Realtime> {
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");

  // 1) spróbuj foxess-lib
  const libArr = await tryFoxessLib();
  if (libArr) {
    const g = (name:string)=> libArr.find(x=> x.variable?.toLowerCase()===name.toLowerCase())?.value;
    const pvPowerW = Number(g('pvPower') ?? g('pv1Power') ?? g('ppv') ?? 0);
    const feedin   = Number(g('feedinPower') ?? g('feedin') ?? 0);
    const gridCons = Number(g('gridConsumptionPower') ?? g('gridConsumption') ?? 0);
    const socRaw   = g('SoC') ?? g('soc') ?? g('batterySoC') ?? g('batterysoc');
    const batterySOC = typeof socRaw === 'number' ? socRaw : undefined;
    return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw: { result: libArr } };
  }

  // 2) fallback: nasz podpis z wariantami
  const payload = { sn: SN, variables: [] as string[] };
  let r:any = await signedFetch("/op/v0/device/real/query", "POST", payload, { perAttemptMs: 3000, maxAttempts: 36 });
  let raw = r?.data ?? r;
  if (raw?.errno === 40256 || raw?.errno === 50000) {
    r = await signedFetch("/op/v1/device/real/query", "POST", payload, { perAttemptMs: 3000, maxAttempts: 36 });
    raw = r?.data ?? r;
  }
  return mapRealtime(raw);
}
