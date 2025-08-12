# FoxESS · RCE Dashboard (Next.js 14)

Lekka aplikacja do **odczytu** danych z FoxESS i cen RCE.
- Ciemny motyw, karty, wykresy jak w oficjalnej aplikacji.
- Bez bazy, bez crona — tylko live-odczyt i prezentacja.

## Start

```bash
npm i
cp .env.example .env  # uzupełnij zmienne (FOXESS_* i RCE_JSON_URL)
npm run dev
```

## Środowisko (.env)

- `FOXESS_REGION` (np. `eu`), `FOXESS_USERNAME`, `FOXESS_PASSWORD`, opcj. `FOXESS_DEVICE_SN`
- `RCE_JSON_URL` – endpoint zwracający listę `{ ts, pricePLN }` (PLN/MWh)
- `NEXT_PUBLIC_BASE_URL` – puste lokalnie; na Vercel ustaw na `https://twoja-domena`

## API

- `GET /api/foxess/realtime` – dane bieżące PV/siatka
- `GET /api/prices/rce` – lista cen z `RCE_JSON_URL`
