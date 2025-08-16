# FoxESS × RCE — Revenue Dashboard (final)

## Start lokalnie
```bash
npm i
cp .env.example .env.local
npm run dev
# http://localhost:3000
```

## Konfiguracja FoxESS (wybierz tryb)
- JSON (masz endpoint zwracający [{timestamp, exported_kwh}]):
```
FOXESS_MODE=json
FOXESS_JSON_URL=https://twoj-api.example.com/energy/hourly?sn=TWÓJ_SN
FOXESS_DEVICE_SN=TWÓJ_SN
```
- CLOUD (bezpośrednio do Twojego API z tokenem, server-side):
```
FOXESS_MODE=cloud
FOXESS_API_BASE=https://twoj-api.example.com
FOXESS_API_TOKEN=sekretny_token
FOXESS_DEVICE_SN=TWÓJ_SN
FOXESS_API_PATH=/energy/hourly
FOXESS_API_METHOD=GET
```
- PROXY (opcjonalny worker):
```
FOXESS_MODE=proxy
FOXESS_PROXY_URL=https://twoj-worker.workers.dev
FOXESS_DEVICE_SN=TWÓJ_SN
```
- MOCK (do podglądu UI):
```
FOXESS_MODE=mock
```

## RCE (PSE)
Backend `/api/rce/pse` pobiera dzienny CSV z raporty.pse.pl i zwraca JSON `{timestamp, price_pln_per_kwh}`.

## Deploy na Vercel
Ustaw w **Environment Variables** (Production/Preview):
- `NEXT_PUBLIC_BASE_URL=https://twoja-domena-vercel.app`
- `FOXESS_MODE` i wymagane zmienne wg wybranego trybu
- `FOXESS_DEVICE_SN`

## Użycie
W aplikacji wybierz **Szybkie zakresy** (np. Wczoraj) → **Odśwież**.
Zobaczysz sumy, wykresy (przychód i kWh) oraz tabelę godzinową.
