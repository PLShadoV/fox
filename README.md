# FoxESS ➜ RCE Revenue App (Demo-first)

Minimalna, ładna aplikacja (Next.js + Tailwind + Recharts), która:
- czyta dane godzinowe z FoxESS (PV, eksport/import do sieci),
- czyta godzinowe ceny RCE (PLN/kWh),
- liczy przychód za wybrany dzień,
- pokazuje KPI i wykres godzinowy.

## Szybki start (DEMO)

```bash
pnpm i # albo: npm i / yarn
cp .env.example .env
pnpm dev
# otwórz http://localhost:3000
```

W trybie DEMO aplikacja używa plików `data/demo-*.json` i nie robi żadnych połączeń zewnętrznych.

## Integracja FoxESS (prod)

1. Zdobądź token API lub konfigurację podpisu (APP_ID/APP_SECRET). W tym repo jest *placeholder* — unikamy wrażliwych danych.
2. Ustaw w `.env`:
   ```env
   DEMO=false
   FOXESS_BASE_URL=https://www.foxesscloud.com
   FOXESS_TOKEN=twój_token
   ```
3. Zaimplementuj realne zapytanie w `lib/foxess.ts` w funkcji `fetchFoxessFromCloud` (komentarz TODO wskazuje miejsce).
   - Zwróć tablicę 24 rekordów godzinowych: `{ time: 'YYYY-MM-DDTHH:00', exportKwh, importKwh, pvKwh }`.

## Integracja RCE (prod)

Masz dwie opcje:
- własny endpoint JSON zwracający godzinowe ceny: `[{ time, price }]` w PLN/kWh,
- modyfikacja `fetchFromUrl` w `lib/rce.ts` do Twojego źródła (np. wewnętrzny proxy).
W `.env` ustaw:
```env
DEMO=false
RCE_JSON_URL=https://twoj-endpoint.pl/rce?date=YYYY-MM-DD
```

## Logika liczenia

- Przychód = suma po godzinach: `exportKwh * price`.
- Średnia cena = średnia arytmetyczna dostępnych godzin z ceną.
- Wykres pokazuje: oddane/pobrane/PV oraz cenę RCE.

## Deploy na Vercel

- Ustaw zmienne środowiskowe (Environment Variables) w projekcie: `DEMO`, `FOXESS_*`, `RCE_JSON_URL`.
- Zbuduj i odpal.

## Styl

- Prosty styl inspirowany aplikacją FoxESS: jasny, karty, miękkie cienie, krawędzie 2xl.
- Recharts dla wykresów, responsywnie.

## Uwaga dot. danych

To repo **nie** zawiera gotowego, produkcyjnego klienta FoxESS ani dostawcy RCE. To świadomy wybór (bezpieczeństwo i brak ujawniania sekretów).
Podłącz swoje źródła w `lib/foxess.ts` i `lib/rce.ts`. W razie potrzeby dostarczę prostą funkcję podpisującą zapytania.
