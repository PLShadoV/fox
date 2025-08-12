import crypto from "crypto";

const BASE = process.env.TUYA_BASE_URL || "https://openapi.tuyaeu.com"; // region EU
const ID = process.env.TUYA_CLIENT_ID || "";
const SECRET = process.env.TUYA_CLIENT_SECRET || "";

type TokenRes = { result: { access_token: string; expire_time: number } };
let cachedToken: { token: string; exp: number } | null = null;

async function signAndFetch(path: string, method: string, body?: any, needToken=true) {
  const t = Date.now().toString();
  let token = "";
  if (needToken) {
    token = await getToken();
  }
  const bodyStr = body ? JSON.stringify(body) : "";
  const contentSha256 = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const stringToSign = [method.toUpperCase(), contentSha256, "", path].join("\n");
  const signStr = ID + (token || "") + t + stringToSign;
  const sign = crypto.createHmac("sha256", SECRET).update(signStr).digest("hex").toUpperCase();

  const headers: any = {
    "t": t,
    "client_id": ID,
    "sign": sign,
    "sign_method": "HMAC-SHA256",
    "mode": "cors",
    "Content-Type": "application/json"
  };
  if (token) headers["access_token"] = token;

  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Tuya HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;
  // grant_type=1 – simple client credentials
  if (!ID || !SECRET) { throw new Error('Brak TUYA_CLIENT_ID / TUYA_CLIENT_SECRET w ENV'); }
  const path = "/v1.0/token?grant_type=1";
  const t = Date.now().toString();
  const stringToSign = ["GET", crypto.createHash("sha256").update("").digest("hex"), "", path].join("\n");
  const signStr = ID + t + stringToSign;
  const sign = crypto.createHmac("sha256", SECRET).update(signStr).digest("hex").toUpperCase();

  const res = await fetch(BASE + path, {
    method: "GET",
    headers: {
      "t": t,
      "client_id": ID,
      "sign": sign,
      "sign_method": "HMAC-SHA256"
    }
  });
  const data: TokenRes = await res.json() as any;
  const token = (data as any)?.result?.access_token;
  if (!token) throw new Error("Brak access_token z Tuya");
  const exp = now + ((data as any)?.result?.expire_time || 3600) * 1000;
  cachedToken = { token, exp };
  return token;
}

export async function getTuyaMeterReading(deviceId: string) {
  // returns DP status
  const path = `/v1.0/devices/${deviceId}/status`;
  const data = await signAndFetch(path, "GET", undefined, true);
  return data;
}

export async function sendTuyaCommand(deviceId: string, dpCode: string, value: any) {
  const path = `/v1.0/devices/${deviceId}/commands`;
  const data = await signAndFetch(path, "POST", { commands: [{ code: dpCode, value }] }, true);
  return data;
}

export async function tuyaDeviceStatus(deviceId: string) {
  return getTuyaMeterReading(deviceId);
}
