export type TuyaCommand = {
  deviceId: string;
  code: string;          // e.g. 'switch_1'
  value: any;            // true/false/number
};

/**
 * Safe stub: passes build and returns clear message in runtime
 * until real Tuya Cloud credentials are configured.
 */
export async function sendTuyaCommand(cmd: TuyaCommand) {
  if (!process.env.TUYA_CLIENT_ID || !process.env.TUYA_CLIENT_SECRET) {
    return {
      ok: false,
      error: "Tuya not configured: set TUYA_CLIENT_ID and TUYA_CLIENT_SECRET in ENV",
      received: cmd
    };
  }
  // Here you would call Tuya Cloud OpenAPI.
  // For now, return a placeholder response.
  return { ok: true, simulated: true, sent: cmd };
}
