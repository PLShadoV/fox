import { createClient } from "foxess-lib";

const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";
const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
const TZ = process.env.FOXESS_TIMEZONE || "Europe/Warsaw";

export type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

export async function getFoxRealtime(): Promise<Realtime> {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");

  const client = createClient({
    baseUrl: BASE,
    auth: { type: "private", token: TOKEN },
    timezone: TZ,
    fetchOptions: { cache: "no-store" }
  });

  // Open API: /op/v1/device/real/query
  const res = await client.device.real.query({ sn: SN, variables: [] });
  const raw: any = res as any;

  // Map wyników do naszego formatu
  const arr: Array<{ variable: string; value: number }> = Array.isArray(raw?.result) ? raw?.result : (raw?.result?.datas || raw?.result?.data || []);
  const g = (name:string)=> arr.find(x=> x.variable?.toLowerCase()===name.toLowerCase())?.value;
  const pvPowerW = Number(g('pvPower') ?? g('pv1Power') ?? g('ppv') ?? 0);
  const feedin   = Number(g('feedinPower') ?? g('feedin') ?? 0);
  const gridCons = Number(g('gridConsumptionPower') ?? g('gridConsumption') ?? 0);
  const socRaw   = g('SoC') ?? g('soc') ?? g('batterySoC') ?? g('batterysoc');
  const batterySOC = typeof socRaw === 'number' ? socRaw : undefined;

  return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw };
}
