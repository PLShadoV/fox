# FoxESS × RCE — Revenue Dashboard

Minimalny szablon do wdrożenia na **Vercel**. Łączy produkcję z FoxESS i ceny RCE, liczy przychód: (Σ export_kWh × price_PLN).

## Szybki start

1. Sklonuj repo i zainstaluj zależności: `npm i`
2. Skopiuj env: `cp .env.example .env.local`
3. `npm run dev` → http://localhost:3000

## Wdróż na Vercel

- Podepnij repo z GitHub do Vercel → *New Project*
- Ustaw **Environment Variables** z `.env.example`
- Deploy (klucze pozostają po stronie serwera)

## Integracja z RCE (PSE)

Aplikacja ma trasę **`/api/rce/pse`**, która pobiera dzienny CSV z `raporty.pse.pl/report/rce-pln` i zwraca JSON:
```json
[{ "timestamp": "2025-08-16T10:00:00Z", "price_pln_per_kwh": 0.5523 }]
```
> PSE publikuje raporty dzienne. Dla zakresów wielodniowych na start pobieramy **dzień = data `from`**. (TODO: batching per dzień przy dłuższych zakresach).

## Integracja z FoxESS (falownik)

Tryb **proxy** ukrywa sekrety i normalizuje dane. W `.env.local`:
```
FOXESS_MODE=proxy
FOXESS_PROXY_URL=https://twoj-proxy.domena.com
FOXESS_DEVICE_SN=603T253021ND064
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
Proxy powinno zwracać *godzinną* energię oddaną w formacie:
```json
[{ "timestamp": "2025-08-16T10:00:00Z", "exported_kwh": 1.234 }]
```

### Przykładowy Cloudflare Worker (szkielet)
Plik: `proxy/foxess-worker.js`
```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/energy/hourly') {
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const sn = url.searchParams.get('sn')
      // TODO: pobierz realne dane z FoxESS Cloud dla SN w zakresie [from,to]
      // Zastępczo zwróć 24h przykładowych danych w poprawnym formacie:
      const start = new Date(from)
      const rows = []
      for (let i=0;i<24;i++){ const t=new Date(start); t.setHours(start.getHours()+i); rows.push({ timestamp: t.toISOString(), exported_kwh: Math.round(Math.random()*2000)/1000 }) }
      return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('Not found', { status: 404 })
  }
}
```

## Wykresy i agregacje

- Zakładki: **Godziny / Dni / Tygodnie / Miesiące / Lata**
- Agregacja ważona po kWh (średnia cena = średnia ważona) i suma przychodów
- Wykresy: **Przychód [PLN]** i **Energia [kWh]**
- **Szybkie zakresy**: Dziś, Wczoraj, Ten/Poprzedni tydzień, Ten/Poprzedni miesiąc, Ten rok

## Roadmap

- Batchowanie wielu dni z PSE (automatycznie)
- Eksport CSV/XLSX
- Presety: ostatnie 7/30/365 dni
- Auth (NextAuth) i multi-site
- Persistencja (Vercel Postgres / Turso)
- Parametry net-billing (opłaty, prowizje, magazyn)
