export async function sendTuyaCommand(_: { deviceId: string; code: string; value: any }) {
  return { ok: false, error: "Not configured" };
}
export async function tuyaDeviceStatus(_: { deviceId: string }) {
  return { ok: false, error: "Not configured", status: null };
}
