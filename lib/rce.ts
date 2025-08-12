import dayjs from "dayjs";

export type RceHour = { time: string; price: number }; // PLN/kWh

async function fetchDemo(date: string): Promise<RceHour[]> {
  const data = await import("../data/demo-rce.json");
  return data.default.map((row: any) => ({
    time: dayjs(date + "T" + row.time.slice(11,16)).format("YYYY-MM-DDTHH:00"),
    price: row.price,
  }));
}

async function fetchFromUrl(date: string): Promise<RceHour[]> {
  const endpoint = process.env.RCE_JSON_URL;
  if (!endpoint) throw new Error("RCE_JSON_URL is not set. Set DEMO=true or provide an endpoint.");
  const url = new URL(endpoint);
  url.searchParams.set("date", date);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("RCE source returned " + res.status);
  const json = await res.json();
  return json;
}

export async function getRceHourly(date: string): Promise<RceHour[]> {
  if (process.env.DEMO === "true") return fetchDemo(date);
  return fetchFromUrl(date);
}

export async function getRceHourlyRange(startDate: string, endDate: string): Promise<RceHour[]> {
  const days: string[] = [];
  let cur = dayjs(startDate);
  const end = dayjs(endDate);
  while (cur.isSame(end) || cur.isBefore(end)) {
    days.push(cur.format("YYYY-MM-DD"));
    cur = cur.add(1, "day");
  }
  const all: RceHour[] = [];
  for (const d of days) {
    const part = await getRceHourly(d);
    all.push(...part);
  }
  return all;
}
