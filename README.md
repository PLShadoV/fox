# Patch UI: FoxESS-like dashboard (Next.js App Router)

Ten patch rozwiązuje błąd prerenderingu strony `/` oraz dodaje:
- komponent `Card` z `subtitle` i slocie `right`,
- dynamiczne flagi dla dashboardu (bez SSG, runtime nodejs),
- wykres cen Day-Ahead jako komponent kliencki (`recharts`).

## Co zrobić
1. Skopiuj zawartość tego folderu do repo **z zachowaniem ścieżek**:
   - `components/ui/Card.tsx`
   - `app/(dashboard)/page.tsx`
   - `app/(dashboard)/price-chart.tsx`
2. Commit + push → Vercel powinien przejść build.
3. (Opcjonalnie) Jeśli masz podobne problemy na innych stronach z UI-klienckim,
   dodaj na ich górze:
   ```ts
   export const dynamic = 'force-dynamic';
   export const revalidate = 0;
   export const runtime = 'nodejs';
   ```
   i ładuj komponenty wymagające przeglądarki przez:
   ```ts
   import dynamic from 'next/dynamic';
   const Komponent = dynamic(() => import('./Komponent'), { ssr: false });
   ```

## Uwaga
- Wykres próbuje pobrać `/api/prices/dayahead?zone=PL&currency=PLN`.
  Jeśli API nie zwróci danych, wykres pokazuje fallback demo, żeby build się nie wywracał.
