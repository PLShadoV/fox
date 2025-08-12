/**
 * FoxESS Cloud Open API (private token auth)
 * Headers:
 *  - token: API key
 *  - timestamp: current ms
 *  - signature: md5(path + "\r\n" + token + "\r\n" + timestamp)  (with fallbacks)
 *  - lang: 'en'
 */
import crypto from "crypto";

const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";

// Single foxFetch with signature variants to avoid "illegal signature" (errno 40256)
type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

export async function getFoxRealtime(): Promise<Realtime> {
  if (!TOKEN) {
    return { pvPowerW: 3200, gridExportW: 500, gridImportW: 150 };
  }
  const path = "/op/v0/device/real/query"; const fallbackPath = "/op/v1/device/real/query";
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");
  const payload = { sn: SN, variables: [] as string[] };
  let data:any = await foxFetch(path, "POST", payload); if (data?.errno === 40256) { data = await foxFetch(fallbackPath, "POST", payload); }
  const result = (data as any)?.result || {};
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : (result.datas || result.data || []);
  let pvPowerW = 0, gridExportW = 0, gridImportW = 0, batterySOC: number | undefined = undefined;

  const get = (name: string) => {
    const hit = arr.find(x => x.variable?.toLowerCase() === name.toLowerCase());
    return hit?.value;
  };

  pvPowerW = Number(get("pvPower") ?? get("pvpower") ?? get("pv1Power") ?? get("ppv") ?? 0);
  const feedin = Number(get("feedinPower") ?? get("feedin") ?? 0);
  const gridCons = Number(get("gridConsumptionPower") ?? get("gridConsumption") ?? 0);
  gridExportW = Math.max(0, feedin);
  gridImportW = Math.max(0, gridCons);
  const soc = get("SoC") ?? get("soc") ?? get("batterySoC") ?? get("batterysoc");
  if (typeof soc === "number") batterySOC = soc;

  return { pvPowerW, gridExportW, gridImportW, batterySOC, raw: data };
}


async function foxFetch(path: string, method: "GET" | "POST", body?: any) {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyHash = crypto.createHash("md5").update(bodyStr).digest("hex");
  const tsMs = Date.now().toString();
  const tsSec = Math.floor(Date.now()/1000).toString();

  // Variants per in-the-wild implementations
  const pathVars = Array.from(new Set([
    path,
    path.endsWith("/") ? path.slice(0,-1) : path + "/",
    path.replace(/\/+$/,""),
  ]));
  const timeVars = [tsMs, tsSec];
  const fmt = (b:Buffer, upper:boolean)=> upper ? b.toString("hex").toUpperCase() : b.toString("hex");
  const signBases = (p:string, tok:string, t:string) => [
    `${p}\r\n${tok}\r\n${t}`,
    `${p}\n${tok}\n${t}`,
    `${p}${tok}${t}`,
    `${p}\r\n${tok}\r\n${t}\r\n${bodyHash}`,
    `${p}\n${tok}\n${t}\n${bodyHash}`,
  ];

  let last: any = null;
  for (const p of pathVars) {
    for (const t of timeVars) {
      for (const base of signBases(p, TOKEN, t)) {
        for (const upper of [false, true]) {
          const sig = fmt(crypto.createHash("md5").update(base).digest(), upper);
          const headers: Record<string,string> = {
            "token": TOKEN,
            "timestamp": t,
            "signature": sig,
            "lang": "en",
            "Accept": "application/json", "Origin":"https://www.foxesscloud.com", "Referer":"https://www.foxesscloud.com/",
            "Content-Type": "application/json",
          };
          const res = await fetch(BASE + p, { method, headers, body: bodyStr || undefined, cache: "no-store" });
          let data: any = null;
          try { data = await res.json(); } catch { data = await res.text(); }
          last = data;
          if (typeof data === 'object' && (data?.errno === 40256 || data?.msg?.toLowerCase?.().includes('illegal'))) {
            continue; // try next variant
          }
          if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}: ${JSON.stringify(data)}`);
          return data;
        }
      }
    }
  }
  return last;
}

