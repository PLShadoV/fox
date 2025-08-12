# FoxESS + Tuya Net‑Billing (Next.js 14 on Vercel)

Monorepo typu **single app** (Next.js App Router) – frontend + API (serverless) + cron w `vercel.json`.
Baza: **Postgres** (Vercel Postgres / Neon) + Prisma.

## Szybki start
```bash
pnpm i   # albo npm i / yarn
cp .env.example .env
# Uzupełnij DATABASE_URL i resztę zmiennych
npx prisma migrate dev --name init
pnpm dev
```
Wejdź na `http://localhost:3000`.

## Deploy na Vercel
- Import repo z GitHub do Vercel.
- Ustaw zmienne środowiskowe (z .env).
- Vercel wykryje Next.js; cron w `vercel.json` utworzy harmonogramy.

## Struktura
- `app/(dashboard)` – dashboard (kafle + wykres cen DA).
- `app/api/*` – API Routes (ingest FoxESS, Tuya, ceny DA/RCEm, sterowanie Tuya, metryki).
- `prisma/schema.prisma` – modele danych.
- `src/lib/*` – klienci i logika kalkulacji.

## Integracje – TODO
- `src/lib/foxess.ts` – wywołania FoxESS Cloud API (realtime, history).
- `src/lib/tuya.ts` – Tuya Cloud (token, status, komendy).
- `src/lib/entsoe.ts` – ENTSO-E Day-Ahead (strefa PL).
- `src/lib/rcem.ts` – parser RCEm/OIRE.

## Zmienne środowiskowe
Zobacz `.env.example`. Minimalny zestaw:
- `DATABASE_URL` – Postgres
- `FOXESS_API_BASE`, `FOXESS_API_KEY`
- `TUYA_CLIENT_ID`, `TUYA_CLIENT_SECRET`
- `ENTSOE_API_TOKEN`
- `PSE_RCEM_URL`

## Uwaga
W repo znajdują się **mocki** danych, żeby UI od razu działał. Wdrożenie realnych wywołań API zostawiono jako krok 2.


## Vercel Free – jak to działa
- Masz **1 zadanie cron** → używamy jednego endpointu: `GET /api/cron/run` co godzinę.
- Endpoint jest **lekki**: pobiera FoxESS realtime, ceny DA i licznik Tuya (jeśli `TUYA_METER_ID`).
- Jeśli chcesz częstsze odpytywanie (np. co 15 min) bez planu Pro:
  - użyj dołączonego workflow **GitHub Actions** (`.github/workflows/ping-cron.yml`) i ustaw secret `CRON_URL` na pełny URL prod: `https://<twoja-aplikacja>.vercel.app/api/cron/run`.
  - workflow będzie pingował endpoint co 15 min.
