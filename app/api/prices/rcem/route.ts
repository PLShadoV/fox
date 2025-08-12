import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function daysInMonth(year:number, month:number){ return new Date(year, month, 0).getDate(); }

export async function GET(req: NextRequest){
  const yyyymm = req.nextUrl.searchParams.get('yyyymm');
  if (!yyyymm) return NextResponse.json({ error: "yyyymm required" }, { status: 400 });
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return NextResponse.json({ error: "Bad yyyymm" }, { status: 400 });
  const dmax = daysInMonth(y, m);
  let all:number[] = [];
  for (let d=1; d<=dmax; d++){
    const date = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/prices/rce-pln?date=${date}`);
      const arr = await r.json();
      const vals = Array.isArray(arr) ? arr.map((x:any)=> Number(x?.rce_pln ?? x?.price)).filter((v:number)=>isFinite(v)) : [];
      all.push(...vals);
    } catch {}
  }
  if (!all.length) return NextResponse.json({ yyyymm, count: 0, average: null });
  const avg = all.reduce((a,b)=>a+b,0) / all.length;
  const min = Math.min(...all);
  const max = Math.max(...all);
  return NextResponse.json({ yyyymm, count: all.length, average: Math.round(avg), min: Math.round(min), max: Math.round(max) });
}
