import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function md5Hex(x:string, upper=false){ const h=crypto.createHash('md5').update(x).digest('hex'); return upper? h.toUpperCase(): h; }

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(new Error('Timeout')), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest){
  const BASE = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";
  const TOKEN = process.env.FOXESS_API_KEY || "";
  const SN = process.env.FOXESS_DEVICE_SN || "";
  const TZ = process.env.FOXESS_TIMEZONE || "Europe/Warsaw";

  const fast = req.nextUrl.searchParams.get('fast') === '1';
  const attemptsCap = Number(req.nextUrl.searchParams.get('attempts') || (fast ? 24 : 60));
  const perAttemptMs = Number(req.nextUrl.searchParams.get('timeoutMs') || 3000);

  if (!TOKEN || !SN) return NextResponse.json({ ok:false, error: "Missing env FOXESS_API_KEY or FOXESS_DEVICE_SN" }, { status: 500 });

  const bodyObj = { sn: SN, variables: [] as string[] };
  const bodyStr = JSON.stringify(bodyObj);
  const bodyHash = md5Hex(bodyStr);
  const baseTs = Date.now();
  const skews = fast ? [0, 10_000, -10_000] : [0, 10_000, -10_000, 60_000, -60_000, 300_000, -300_000];
  const units: Array<'ms'|'sec'> = ['ms','sec'];
  const tsKeys = ['timestamp','timeStamp'];
  const tzKeys = ['timezone','timeZone','tz'];
  const tzValues = [TZ, '+01:00', '+02:00'];
  const paths = ["/op/v0/device/real/query", "/op/v1/device/real/query"];

  const signBases = (p:string, tok:string, t:string) => [
    `${p}\r\n${tok}\r\n${t}`,
    `${p}\n${tok}\n${t}`,
    `${p}${tok}${t}`,
    `${p}\r\n${tok}\r\n${t}\r\n${bodyHash}`,
    `${p}\n${tok}\n${t}\n${bodyHash}`,
  ];

  let attempts:number = 0;
  let last:any = null;

  for (const path of paths){
    for (const skew of skews){
      for (const unit of units){
        const tsVal = unit==='ms' ? String(baseTs+skew) : String(Math.floor((baseTs+skew)/1000));
        for (const tkey of tsKeys){
          for (const tzKey of tzKeys){
            for (const tzVal of tzValues){
              for (const upper of [false, true]){
                for (const base of signBases(path, TOKEN, tsVal)){
                  attempts++;
                  if (attempts > attemptsCap) return NextResponse.json({ ok:false, attempts, last, note:"attempt cap reached" }, { status: 504 });
                  const sig = md5Hex(base, upper);
                  const headers: Record<string,string> = {
                    "token": TOKEN, [tkey]: tsVal, "signature": sig, "lang":"en",
                    [tzKey]: tzVal,
                    "Accept":"application/json", "Content-Type":"application/json",
                    "Accept-Language":"en-US,en;q=0.9",
                    "Origin":"https://www.foxesscloud.com", "Referer":"https://www.foxesscloud.com/"
                  };
                  try {
                    const res = await fetchWithTimeout(BASE + path, {
                      method: "POST", headers, body: bodyStr, cache: "no-store"
                    }, perAttemptMs);
                    let data:any = null; try { data = await res.json(); } catch { data = await res.text(); }
                    last = { data, debug: { path, tkey, unit, skew, upper, tzKey, tzVal, status: res.status, attempts } };
                    if (typeof data==='object' && (data?.errno===40256 || String(data?.msg||'').toLowerCase().includes('illegal'))) {
                      continue;
                    }
                    if (!res.ok) return NextResponse.json({ ok:false, attempts, last, note: "HTTP not ok" }, { status: res.status });
                    return NextResponse.json({ ok:true, attempts, match: last });
                  } catch (e:any) {
                    last = { error: e?.message || String(e), debug: { path, tkey, unit, skew, upper, tzKey, tzVal, attempts } };
                    continue;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok:false, attempts, last, note: "All attempts flagged/timeout" }, { status: 502 });
}
