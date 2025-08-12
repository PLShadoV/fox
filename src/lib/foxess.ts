import axios from "axios";

type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; };

export async function getFoxRealtime(): Promise<Realtime> {
  // Placeholder – implement with FoxESS Cloud API
  // Uses FOXESS_API_BASE and FOXESS_API_KEY
  if (!process.env.FOXESS_API_KEY) {
    // Return mock to let the UI render
    return { pvPowerW: 3200, gridExportW: 500, gridImportW: 150 };
  }
  // TODO: real call. Keep edge runtime in mind (fetch instead of axios)
  return { pvPowerW: 0, gridExportW: 0, gridImportW: 0 };
}
