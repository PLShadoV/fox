import dayjs from "dayjs";
import crypto from "crypto";
import { signPrivate } from "./foxess-sign";

export type FoxHour = { time: string; exportKwh: number; importKwh: number; pvKwh: number };

const BASE = process.env.FOXESS_BASE_URL || "https://www.foxesscloud.com";
const DEVICE_SN = process.env.FOXESS_DEVICE_SN || "";
const TZ = process.env.FOXESS_TIMEZONE || "Europe/Warsaw";

/**
 * Map z surowego JSON FoxESS do naszej struktury godzinowej.
 * Dostosuj to do realnego kształtu zwracanego przez API (klucze mogą się różnić).
 */
function mapFoxessHourly(json: any, date: string): FoxHour[] {
  // Oczekujemy tablicy godzin: [{ time: 'YYYY-MM-DDTHH:00', exportKwh, importKwh, pvKwh }]
  // Jeżeli API zwraca osobne tablice, złącz je tutaj.
  if (Array.isArray(json)) {
    return json.map((row: any) => ({
      time: row.time ?? dayjs(date).hour(row.hour ?? 0).minute(0).second(0).format("YYYY-MM-DDTHH:00"),
      exportKwh: Number(row.exportKwh ?? row.feedin ?? 0),
      importKwh: Number(row.importKwh ?? row.gridConsumption ?? 0),
      pvKwh: Number(row.pvKwh ?? row.pv ?? row.production ?? 0),
    }));
  }
  if (Array.isArray(json?.data)) return mapFoxessHourly(json.data, date);
  if (Array.isArray(json?.result)) return mapFoxessHourly(json.result, date);
  throw new Error("Nieznany format odpowiedzi FoxESS (dostosuj mapowanie).");
}

async function foxessWithToken(path: string, body: any) {
  const token = process.env.FOXESS_TOKEN;
  if (!token) throw new Error("Brak FOXESS_TOKEN");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body),
    // Next.js fetch on server is ok
  } as any);
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}`);
  return res.json();
}

async function foxessWithPrivate(path: string, body: any) {
  const appId = process.env.FOXESS_APP_ID || "";
  const appSecret = process.env.FOXESS_APP_SECRET || "";
  if (!appId || !appSecret) throw new Error("Brak APP_ID/APP_SECRET");
  const { nonce, timestamp, sign } = signPrivate(appId, appSecret);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "appId": appId,
      "nonce": nonce,
      "timestamp": timestamp,
      "sign": sign
    },
    body: JSON.stringify(body),
  } as any);
  if (!res.ok) throw new Error(`FoxESS HTTP ${res.status}`);
  return res.json();
}

/**
 * Pobiera godziny dla jednego dnia.
 * domyślnie używa ścieżki /op/v1/plant/energy/list jako przykładowej – dostosuj do Twojego konta,
 * wiele wdrożeń FoxESS używa podobnego schematu.
 */
async function fetchFoxessFromCloud(date: string): Promise<FoxHour[]> {
  if (!DEVICE_SN) throw new Error("FOXESS_DEVICE_SN nieustawione");
  const start = dayjs(date).startOf("day").format("YYYY-MM-DD 00:00:00");
  const end = dayjs(date).endOf("day").format("YYYY-MM-DD 23:59:59");

  const path = "/op/v1/plant/energy/list"; // ← dostosuj, jeśli inny
  const body = {
    sn: DEVICE_SN,
    timeType: "HOUR",
    beginTime: start,
    endTime: end,
    tz: TZ
  };

  try {
    const json = await foxessWithToken(path, body);
    return mapFoxessHourly(json, date);
  } catch (e) {
    // Spróbuj tryb 'private sign' jeśli token nie działa
    const json = await foxessWithPrivate(path, body);
    return mapFoxessHourly(json, date);
  }
}

async function fetchDemo(date: string): Promise<FoxHour[]> {
  const data = await import("../data/demo-day.json");
  const base = data.default;
  return base.map((row: any) => ({
    time: dayjs(date + "T" + row.time.slice(11,16)).format("YYYY-MM-DDTHH:00"),
    exportKwh: row.exportKwh,
    importKwh: row.importKwh,
    pvKwh: row.pvKwh,
  }));
}

export async function getFoxessHourly(date: string): Promise<FoxHour[]> {
  if (process.env.DEMO === "true") return fetchDemo(date);
  return fetchFoxessFromCloud(date);
}

/** Zakres dat (dni) – sklej po godzinach */
export async function getFoxessHourlyRange(startDate: string, endDate: string): Promise<FoxHour[]> {
  const days: string[] = [];
  let cur = dayjs(startDate);
  const end = dayjs(endDate);
  while (cur.isSame(end) || cur.isBefore(end)) {
    days.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "day");
  }
  const all: FoxHour[] = [];
  for (const d of days) {
    const part = await getFoxessHourly(d);
    all.push(...part);
  }
  return all;
}
