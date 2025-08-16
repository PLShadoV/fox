import { EnergyPoint, PricePoint, RevenuePoint } from './types'
export function mergeAndCalcRevenue(energy: EnergyPoint[], prices: PricePoint[]): RevenuePoint[] {
  const priceMap = new Map(prices.map(p => [new Date(p.timestamp).toISOString(), p.price_pln_per_kwh]))
  return energy.map(e => {
    const key = new Date(e.timestamp).toISOString()
    const price = priceMap.get(key) ?? 0
    return { timestamp: key, exported_kwh: e.exported_kwh, price_pln_per_kwh: price, revenue_pln: Math.round(e.exported_kwh * price * 100) / 100 }
  })
}
export function sumRevenue(rows: RevenuePoint[]){ return { total_kwh: Math.round(rows.reduce((a,b)=>a+b.exported_kwh,0)*100)/100, total_pln: Math.round(rows.reduce((a,b)=>a+b.revenue_pln,0)*100)/100 } }
export type Aggregate = { key:string; label:string; exported_kwh:number; avg_price_pln_per_kwh:number; revenue_pln:number }
type Granularity = 'hour'|'day'|'week'|'month'|'year'
export function aggregate(rows: RevenuePoint[], granularity: Granularity): Aggregate[] {
  const tz='Europe/Warsaw', buckets = new Map<string, Aggregate>()
  for(const r of rows){
    const d=new Date(r.timestamp)
    const parts=new Intl.DateTimeFormat('pl-PL',{ timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit', hour: granularity==='hour'?'2-digit':undefined }).formatToParts(d)
    const y=parts.find(p=>p.type==='year')!.value, m=parts.find(p=>p.type==='month')!.value, da=parts.find(p=>p.type==='day')!.value, h= granularity==='hour'? parts.find(p=>p.type==='hour')!.value : '00'
    let key='', label=''
    if(granularity==='hour'){ key=`${y}-${m}-${da} ${h}:00`; label=key }
    else if(granularity==='day'){ key=`${y}-${m}-${da}`; label=key }
    else if(granularity==='month'){ key=`${y}-${m}`; label=`${y}-${m}` }
    else if(granularity==='year'){ key=`${y}`; label=y }
    else if(granularity==='week'){ const wk=isoWeekNumber(d,tz); key=`${y}-W${wk.toString().padStart(2,'0')}`; label=key }
    const prev=buckets.get(key)
    if(!prev){ buckets.set(key,{ key,label, exported_kwh:r.exported_kwh, avg_price_pln_per_kwh:r.price_pln_per_kwh, revenue_pln:r.revenue_pln }) }
    else { const totalK=prev.exported_kwh+r.exported_kwh; const weighted=(prev.avg_price_pln_per_kwh*prev.exported_kwh + r.price_pln_per_kwh*r.exported_kwh)/(totalK||1); prev.exported_kwh=Math.round(totalK*100)/100; prev.avg_price_pln_per_kwh=Math.round(weighted*10000)/10000; prev.revenue_pln=Math.round((prev.revenue_pln+r.revenue_pln)*100)/100 }
  }
  return Array.from(buckets.values()).sort((a,b)=>a.key.localeCompare(b.key))
}
function isoWeekNumber(date: Date, timeZone: string){ const parts=new Intl.DateTimeFormat('pl-PL',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const y=Number(parts.find(p=>p.type==='year')!.value); const m=Number(parts.find(p=>p.type==='month')!.value); const d=Number(parts.find(p=>p.type==='day')!.value); const local=new Date(Date.UTC(y,m-1,d)); const dayNum=(local.getUTCDay()+6)%7; local.setUTCDate(local.getUTCDate()-dayNum+3); const firstThursday=new Date(Date.UTC(local.getUTCFullYear(),0,4)); const diff=local.getTime()-firstThursday.getTime(); return 1+Math.round(diff/604800000) }
