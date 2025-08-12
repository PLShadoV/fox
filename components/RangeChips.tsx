'use client'
import React from "react";
import dayjs from "dayjs";

export type RangeKey = "today" | "yesterday" | "month" | "custom";

export default function RangeChips({ range, setDate, setRange }:{ range: RangeKey; setDate:(d:string)=>void; setRange:(r:RangeKey)=>void }){
  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  return (
    <div className="flex gap-2 flex-wrap">
      {[
        { key:"today", label:"Dzisiaj", on: range==="today", onClick:()=> { setDate(today); setRange("today") } },
        { key:"yesterday", label:"Wczoraj", on: range==="yesterday", onClick:()=> { setDate(yesterday); setRange("yesterday") } },
        { key:"month", label:"Miesiąc", on: range==="month", onClick:()=> setRange("month") },
        { key:"custom", label:"Własny", on: range==="custom", onClick:()=> setRange("custom") },
      ].map(b => (
        <button key={b.key} onClick={b.onClick}
          className={"px-3 py-2 rounded-full border " + (b.on ? "bg-black text-white" : "bg-white text-gray-800 border-gray-200")}>
          {b.label}
        </button>
      ))}
    </div>
  )
}
