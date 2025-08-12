'use client';
import React, { useState } from 'react';

function Node({ k, v, level=0 }:{k?:string; v:any; level?:number}){
  const [open, setOpen] = useState(level<1);
  if (v && typeof v === 'object') {
    const entries = Array.isArray(v) ? v.map((x,i)=>[i,x]) : Object.entries(v);
    return (
      <div style={{ marginLeft: level?12:0 }}>
        <div className="cursor-pointer" onClick={()=>setOpen(o=>!o)}>
          <span className="badge">{open?'−':'+'}</span> {k ?? (Array.isArray(v)?'[]':'{}')}
        </div>
        {open && <div>{entries.map(([ck,cv],i)=>(<Node key={i} k={String(ck)} v={cv} level={level+1}/>))}</div>}
      </div>
    );
  }
  return <div style={{ marginLeft: level?12:0 }}><span className="muted">{k}:</span> <span className="kbd">{String(v)}</span></div>;
}

export default function JsonTree({ data }:{ data:any }){
  return <div className="text-sm"><Node v={data} /></div>;
}
