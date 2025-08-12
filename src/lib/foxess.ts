// Uses community foxess-lib (>=0.6.6) which implements the current signature rules.
// Install: npm i foxess-lib@0.6.6
import inverter from "foxess-lib/lib/inverter";

const TOKEN = process.env.FOXESS_API_KEY || "";
const SN = process.env.FOXESS_DEVICE_SN || "";
const TZ = process.env.FOXESS_TIMEZONE || "Europe/Warsaw";

export type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; raw?: any };

export async function getFoxRealtime(): Promise<Realtime> {
  if (!TOKEN) throw new Error("Brak FOXESS_API_KEY w ENV");
  if (!SN) throw new Error("FOXESS_DEVICE_SN nie ustawione");

  // foxess-lib handles headers/signature. It calls /op/v0/device/real/query internally.
  const result = await inverter.getRealTimeData(TOKEN, { sn: SN });
  const arr: Array<{ variable: string; value: number }> = Array.isArray(result) ? result : [];

  const g = (name:string)=> arr.find(x=> x.variable?.toLowerCase()===name.toLowerCase())?.value;
  const pvPowerW = Number(g('pvPower') ?? g('pv1Power') ?? g('ppv') ?? 0);
  const feedin   = Number(g('feedinPower') ?? g('feedin') ?? 0);
  const gridCons = Number(g('gridConsumptionPower') ?? g('gridConsumption') ?? 0);
  const socRaw   = g('SoC') ?? g('soc') ?? g('batterySoC') ?? g('batterysoc');
  const batterySOC = typeof socRaw === 'number' ? socRaw : undefined;

  return { pvPowerW, gridExportW: Math.max(0, feedin), gridImportW: Math.max(0, gridCons), batterySOC, raw: { result } };
}
