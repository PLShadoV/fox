'use client'
function toISO(d: Date){ return new Date(d).toISOString() }
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x }
function startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999) }
function startOfWeek(d=new Date()){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x }
function endOfWeek(d=new Date()){ const s=startOfWeek(d); s.setDate(s.getDate()+6); s.setHours(23,59,59,999); return s }
export default function QuickRanges({ onPick }:{ onPick:(from:string,to:string)=>void }){
  return <div className="flex flex-wrap gap-2">
    <button className="btn" onClick={()=>onPick(toISO(startOfDay()), toISO(endOfDay()))}>Dziś</button>
    <button className="btn" onClick={()=>{ const y=new Date(); y.setDate(y.getDate()-1); onPick(toISO(startOfDay(y)), toISO(endOfDay(y))) }}>Wczoraj</button>
    <button className="btn" onClick={()=>onPick(toISO(startOfWeek()), toISO(endOfWeek()))}>Ten tydzień</button>
    <button className="btn" onClick={()=>{ const s=startOfWeek(); s.setDate(s.getDate()-7); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); onPick(toISO(s), toISO(e)) }}>Poprzedni tydzień</button>
    <button className="btn" onClick={()=>onPick(toISO(startOfMonth()), toISO(endOfMonth()))}>Ten miesiąc</button>
    <button className="btn" onClick={()=>{ const d=new Date(); const s=new Date(d.getFullYear(), d.getMonth()-1, 1); const e=new Date(d.getFullYear(), d.getMonth(), 0, 23,59,59,999); onPick(toISO(s), toISO(e)) }}>Poprzedni miesiąc</button>
    <button className="btn" onClick={()=>{ const d=new Date(); const s=new Date(d.getFullYear(),0,1); const e=new Date(d.getFullYear(),11,31,23,59,59,999); onPick(toISO(s), toISO(e)) }}>Ten rok</button>
  </div>
}
