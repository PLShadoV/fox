// src/lib/tuya.ts

export type TuyaCommand = {
  deviceId: string;
  code: string;
  value: any;
};

// Zwraca no-op, żeby backend przechodził build nawet bez TUYA_* w ENV
export async function sendTuyaCommand(cmd: TuyaCommand) {
  const configured = !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
  if (!configured) {
    return { ok: false, status: 501, message: "Tuya not configured" };
  }
  // TODO: tutaj docelowo wywołanie Tuya Cloud API
  return { ok: true };
}

// Prosty status urządzenia (stub)
export async function tuyaDeviceStatus(deviceId: string) {
  const configured = !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
  if (!configured) {
    return { ok: false, status: 501, message: "Tuya not configured" };
  }
  return { ok: true, result: [] };
}

// Prosty odczyt licznika (stub)
export async function getTuyaMeterReading(deviceId: string) {
  const configured = !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
  if (!configured) {
    return { ok: false, status: 501, message: "Tuya not configured", watts: 0, importWh: 0, exportWh: 0 };
  }
  // TODO: mapowanie z DP -> wartości
  return { ok: true, watts: 0, importWh: 0, exportWh: 0 };
}
