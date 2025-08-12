// src/lib/foxess.ts
/**
 * FoxESS Cloud API — prefer OAuth (Bearer), fallback to Private Token.
 */
import crypto from "crypto";
import { getToken } from "@/src/db/oauth";

const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";

type Realtime = {
  pvPowerW: number;
  gridExportW: number;
  gridImportW: number;
  batterySOC?: number;
  raw?: any;
};

// ONE foxFetch only
async function foxFetch(path: string, method: "GET" | "POST", body?: any) {
  const bodyStr = body ? JSON.stringify(body) : "";

  // 1) OAuth Bearer
  try {
    const t = await getToken("foxess");
    if (t?.accessToken) {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          Authorization: `Bearer ${t.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: bodyStr || undefined,
        cache: "no-store",
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
      if (res.ok) return data;
      // jeśli 401/403 – lecimy fallbackiem
    }
  } catch {}

  // 2) Private token fallback (różne warianty podpisu, jeśli chcesz korzystać z tego trybu)
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV (fallback private-token)");
  const bodyHash = crypto.createHash("md5").update(bodyStr).digest("hex");
  const tsMs = Date.now().toString();
  const tsSec = Math.floor(Date.now() / 1000).toString();
  const pathVars = Array.from(new Set([path, path.endsWith("/") ? path.slice(0, -1) : path + "/", path.replace(/\/+$/, "")]));
  const timeVars = [tsMs, tsSec];
  const fmt = (b: Buffer, upper: boolean) => (upper ? b.toString("hex").toUpperCase() : b.toString("hex"));
  const signBases = (p: string, tok: string, t: string) => [
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
          const headers: Record<string, string> = {
            token: TOKEN,
            timestamp: t,
            signature: sig,
            lang: "en",
            Accept: "application/json",
            Origin: "https://www.foxesscloud.com",
            Referer: "https://www.foxesscloud.com/",
            "Content-Type": "application/json",
          };
          const res = await fetch(BASE + p, {
            method,
            headers,
            body: bodyStr || undefined,
            cache: "no-store",
          });
          let data: any;
          try {
            data = await res.json();
          } catch {
            data = await res.text();
          }
          last = data;
          if (typeof data === "object" && (data?.errno === 40256 || data?.msg?.toLowerCase?.().includes("illegal"))) {
            continue; // spróbuj kolejny wariant
          }
          if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}: ${JSON.stringify(data)}`);
          return data;
        }
      }
    }
  }
  return last;
}

export async function getFoxRealtime(): Promise<Realtime> {
  const path = "/op/v0/device/real/query";
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");
  const payload = { sn: SN, variables: [] as string[] };
  const data: any = await foxFetch(path, "POST", payload);
  const result = data?.result || {};
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : result.datas || result.data || [];

  const findVal = (name: string) => arr.find((x) => x.variable?.toLowerCase() === name.toLowerCase())?.value;
  const pvPowerW = Number(findVal("pvPower") ?? findVal("pv1Power") ?? findVal("ppv") ?? 0);
  const feedin = Number(findVal("feedinPower") ?? findVal("feedin") ?? 0);
  const gridCons = Number(findVal("gridConsumptionPower") ?? findVal("gridConsumption") ?? 0);
  const soc = findVal("SoC") ?? findVal("soc") ?? findVal("batterySoC") ?? findVal("batterysoc");
  const batterySOC = typeof soc === "number" ? soc : undefined;

  return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw: data };
}
