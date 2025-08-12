/**
 * FoxESS Cloud Open API (Private Token only)
 * Signs requests with multiple variants to avoid 'illegal signature' 40256.
 */
import crypto from "crypto";

const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";

type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

async function foxFetch(path: string, method: "GET" | "POST", body?: any) {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyHash = crypto.createHash("md5").update(bodyStr).digest("hex");
  const tsMs = Date.now().toString();
  const tsSec = Math.floor(Date.now()/1000).toString();
  const pathVars = Array.from(new Set([
    path,
    path.endsWith("/") ? path.slice(0,-1) : path + "/",
    path.replace(/\/+$/,"")
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
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://www.foxesscloud.com",
            "Referer":"https://www.foxesscloud.com/"
          };
          const res = await fetch(BASE + p, { method, headers, body: bodyStr || undefined, cache: "no-store" });
          let data: any = null;
          try { data = await res.json(); } catch { data = await res.text(); }
          last = data;
          if (typeof data === 'object' && (data?.errno === 40256 || data?.msg?.toLowerCase?.().includes('illegal'))) continue;
          if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}: ${JSON.stringify(data)}`);
          return data;
        }
      }
    }
  }
  return last;
}

export async function getFoxRealtime(): Promise<Realtime> {
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");
  const payload = { sn: SN, variables: [] as string[] };
  // try v0 then v1
  let data: any = await foxFetch("/op/v0/device/real/query", "POST", payload);
  if (data?.errno === 40256) data = await foxFetch("/op/v1/device/real/query", "POST", payload);
  const result = data?.result || {};
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : (result.datas || result.data || []);

  const get = (name: string) => arr.find(x => x.variable?.toLowerCase() === name.toLowerCase())?.value;
  const pvPowerW = Number(get("pvPower") ?? get("pv1Power") ?? get("ppv") ?? 0);
  const feedin = Number(get("feedinPower") ?? get("feedin") ?? 0);
  const gridCons = Number(get("gridConsumptionPower") ?? get("gridConsumption") ?? 0);
  const soc = get("SoC") ?? get("soc") ?? get("batterySoC") ?? get("batterysoc");
  const batterySOC = typeof soc === "number" ? soc : undefined;

  return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw: data };
}
