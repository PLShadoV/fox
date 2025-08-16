'use client'
import clsx from 'clsx'
export default function Tabs({ value, onChange, items }:{ value:string, onChange:(v:string)=>void, items:{value:string,label:string}[] }){
  return <div className="flex gap-2 flex-wrap">
    {items.map(i => <button key={i.value} onClick={()=>onChange(i.value)} className={clsx('btn', value===i.value && 'bg-white/20')}>{i.label}</button>)}
  </div>
}
