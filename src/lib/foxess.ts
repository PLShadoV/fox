import { getFoxRealtime } from "foxess-lib";

export type FoxRealtime = {
  pvPowerW?: number;
  gridExportW?: number;
  gridImportW?: number;
  todayYieldKWh?: number;
  raw?: any;
};

export async function readFoxRealtime(): Promise<FoxRealtime> {
  const data: any = await getFoxRealtime();
  const map = new Map<string, number | string>();
  try {
    const datas = data?.raw?.result?.[0]?.datas ?? data?.raw?.datas ?? [];
    for (const d of datas) map.set(d.variable, d.value);
  } catch {}

  const pvKw = Number(map.get("pvPower")) || 0;
  const feedinKw = Number(map.get("feedinPower")) || 0;
  const gridConsKw = Number(map.get("gridConsumptionPower")) || 0;
  const todayYield = Number(map.get("todayYield")) || undefined;

  return {
    pvPowerW: Math.round(pvKw * 1000),
    gridExportW: Math.round(feedinKw * 1000),
    gridImportW: Math.round(gridConsKw * 1000),
    todayYieldKWh: todayYield,
    raw: data?.raw ?? data,
  };
}
