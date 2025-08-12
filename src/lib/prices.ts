export type PricePoint = { ts: string; pricePLN: number };

async function fetchJSON(url?: string) {
  if (!url) throw new Error("Missing URL");
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function readRCE(): Promise<PricePoint[]> {
  const url = process.env.RCE_JSON_URL;
  const json = await fetchJSON(url);
  if (Array.isArray(json) && json.length && "pricePLN" in json[0]) return json as PricePoint[];
  const out: PricePoint[] = [];
  const base = (json as any)?.data ?? json;
  if (base && typeof base === "object") {
    for (const k of Object.keys(base as any)) {
      out.push({ ts: k, pricePLN: Number((base as any)[k]) });
    }
    out.sort((a,b)=>a.ts.localeCompare(b.ts));
  }
  return out;
}
