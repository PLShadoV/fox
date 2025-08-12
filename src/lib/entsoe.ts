import { XMLParser } from "fast-xml-parser";

type Row = { ts: string; pricePLNMWh: number };

function fmtDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth()+1).padStart(2,'0');
  const d = String(date.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export async function getDayAheadPL(dateInput: string): Promise<Row[]> {
  const token = process.env.ENTSOE_API_TOKEN || "";
  if (!token) {
    // fallback demo
    const now = new Date();
    return Array.from({length: 24}, (_,h)=>{
      const d = new Date(now); d.setUTCHours(h,0,0,0);
      return { ts: d.toISOString().slice(11,16), pricePLNMWh: 450 + Math.round(Math.sin(h/24*Math.PI*2)*50) };
    });
  }
  let d: Date;
  if (dateInput === 'today') d = new Date();
  else d = new Date(dateInput);
  const day = fmtDate(d);
  // EIC for Poland bidding zone: 10YPLENERGY----S
  const inDomain = "10YPLENERGY----S";
  const doc = "A44"; // Day-ahead prices
  const base = "https://web-api.tp.entsoe.eu/api";
  const params = new URLSearchParams({
    securityToken: token,
    documentType: doc,
    in_Domain: inDomain,
    out_Domain: inDomain,
    periodStart: day.replace(/-/g,"") + "0000",
    periodEnd:   day.replace(/-/g,"") + "2300"
  });
  const res = await fetch(`${base}?${params.toString()}`, { headers: { "Accept": "application/xml" } });
  if (!res.ok) throw new Error("ENTSO-E HTTP " + res.status);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const j: any = parser.parse(xml);
  const series = j?.Publication_MarketDocument?.TimeSeries;
  const pts = Array.isArray(series?.Period?.Point) ? series.Period.Point : series?.Period?.Point ? [series.Period.Point] : [];
  const priceList: Row[] = pts.map((p:any, idx:number) => {
    const priceEURMWh = parseFloat(p["price.amount"]);
    const ts = String(idx).padStart(2,'0') + ":00";
    const pricePLNMWh = priceEURMWh * (parseFloat(process.env.EURPLN || "4.3"));
    return { ts, pricePLNMWh };
  });
  return priceList;
}
