import axios from "axios";

export async function getTuyaMeterReading(deviceId: string) {
  if (!process.env.TUYA_CLIENT_ID) {
    return { deviceId, importWh: 0, exportWh: 0 };
  }
  // TODO: implement Tuya auth flow and device status/DP read
  return { deviceId, importWh: 0, exportWh: 0 };
}

export async function sendTuyaCommand(deviceId: string, dpCode: string, value: any) {
  if (!process.env.TUYA_CLIENT_ID) return { ok: false, reason: "tuya creds missing" };
  // TODO: implement Tuya command call
  return { ok: true };
}
