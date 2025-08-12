/**
 * FoxESS Cloud klient – szkielet.
 * Wymaga skonfigurowania poprawnych endpointów i klucza API w ENV.
 * Jeśli brak kluczy, zwraca mock, aby UI działał.
 */
type Realtime = { pvPowerW: number; gridExportW: number; gridImportW: number; batterySOC?: number; };

export async function getFoxRealtime(): Promise<Realtime> {
  const key = process.env.FOXESS_API_KEY;
  if (!key) {
    // Mock
    return { pvPowerW: 3200, gridExportW: 500, gridImportW: 150 };
  }
  // TODO: Zaimplementuj wywołanie FoxESS Cloud wg Twoich danych (token, ścieżki API).
  // Na przykład: fetch(`${process.env.FOXESS_API_BASE}/...`, { headers: { Authorization: `Bearer ${key}` } })
  return { pvPowerW: 0, gridExportW: 0, gridImportW: 0 };
}
