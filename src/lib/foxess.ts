/**
 * FoxESS Cloud Open API (private token auth)
 * Docs: https://www.foxesscloud.com/public/i18n/en/OpenApiDocument.html
 * Headers:
 *  - token: API key (from FoxESS Cloud -> User Profile -> API Management)
 *  - timestamp: current ms
 *  - signature: md5(path + "\r\n" + token + "\r\n" + timestamp)
 *  - lang: 'en' | 'pl'
 */
import crypto from "crypto";

const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";

async function foxFetch(path: string, method: "GET" | "POST", body?: any) {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  const timestamp = Date.now().toString();
  const signatureBase = `${path}\r\n${TOKEN}\r\n${timestamp}`;
  const signature = crypto.createHash("md5").update(signatureBase).digest("hex");
  const headers: Record<string, string> = {
    "token": TOKEN,
    "timestamp": timestamp,
    "signature": signature,
    "lang": "en",
    "Content-Type": "application/json",
    "User-Agent": "NetBilling-Dashboard/1.0"
  };
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`FoxESS HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

export async function getFoxRealtime(): Promise<Realtime> {
  if (!TOKEN) {
    // Mock for local dev
    return { pvPowerW: 3200, gridExportW: 500, gridImportW: 150 };
  }
  const path = "/op/v0/device/real/query";
  const sn = SN;
  if (!sn) throw new Error("FOXESS_DEVICE_SN nie ustawione");
  // Per docs, variables can be empty to fetch all
  const payload = { sn, variables: [] as string[] };
  const data = await foxFetch(path, "POST", payload);
  // data.result is expected; try to map common fields:
  const result = (data as any)?.result || {};
  // Some deployments return an array of { variable: 'xxx', value: number }
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : (result.datas || result.data || []);
  let pvPowerW = 0, gridExportW = 0, gridImportW = 0, batterySOC: number | undefined = undefined;

  const get = (name: string) => {
    const hit = arr.find(x => x.variable?.toLowerCase() === name.toLowerCase());
    return hit?.value;
  };

  // Heuristics for variable names used by FoxESS Open API
  pvPowerW = Number(get("pvPower") ?? get("pvpower") ?? get("pv1Power") ?? get("ppv") ?? 0);
  const feedin = Number(get("feedinPower") ?? get("feedin") ?? 0);
  const gridCons = Number(get("gridConsumptionPower") ?? get("gridConsumption") ?? 0);
  // Export/import estimation
  gridExportW = Math.max(0, feedin);
  gridImportW = Math.max(0, gridCons);
  const soc = get("SoC") ?? get("soc") ?? get("batterySoC") ?? get("batterysoc");
  if (typeof soc === "number") batterySOC = soc;

  return { pvPowerW, gridExportW, gridImportW, batterySOC, raw: data };
}


async function foxFetch(path: string, method: "GET" | "POST", body?: any) {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  const timestamp = Date.now().toString();
  const variants = [
    (p:string,tok:string,ts:string)=>crypto.createHash("md5").update(`${p}\r\n${tok}\r\n${ts}`).digest("hex"),
    (p:string,tok:string,ts:string)=>crypto.createHash("md5").update(`${p}\n${tok}\n${ts}`).digest("hex"),
    (p:string,tok:string,ts:string)=>crypto.createHash("md5").update(`${p}${tok}${ts}`).digest("hex")
  ];
  let lastResp: any = null;
  for (let i=0;i<variants.length;i++) {
    const signature = variants[i](path, TOKEN, timestamp);
    const headers: Record<string, string> = {
      "token": TOKEN,
      "timestamp": timestamp,
      "signature": signature,
      "lang": "en",
      "Content-Type": "application/json",
      "User-Agent": "NetBilling-Dashboard/1.0"
    };
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    let data: any = null;
    try { data = await res.json(); } catch { data = await res.text(); }
    lastResp = data;
    // If signature illegal (40256) try next variant
    if (typeof data === 'object' && data?.errno === 40256) continue;
    if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  // All failed – return last response so user can see the error
  return lastResp;
}
