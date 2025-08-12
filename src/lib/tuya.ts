export type TuyaCommand = { deviceId: string; code: string; value: any };

function notConfigured() {
  return !(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
}

export async function sendTuyaCommand(cmd: TuyaCommand) {
  if (notConfigured()) {
    return { ok: false, error: "Tuya not configured: set TUYA_CLIENT_ID and TUYA_CLIENT_SECRET in ENV", received: cmd };
  }
  return { ok: true, simulated: true, sent: cmd };
}

export async function getTuyaMeterReading(deviceId?: string) {
  if (notConfigured()) {
    return { ok: false, error: "Tuya not configured", deviceId };
  }
  // Placeholder reading
  return { ok: true, deviceId, ts: new Date().toISOString(), importW: 0, exportW: 0 };
}

export async function tuyaDeviceStatus(deviceId?: string) {
  if (notConfigured()) {
    return { ok: false, error: "Tuya not configured", deviceId };
  }
  return { ok: true, deviceId, online: true };
}
