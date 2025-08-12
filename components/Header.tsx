'use client'
import React from "react";
import dayjs from "dayjs";
import RangeChips, { RangeKey } from "./RangeChips";

export default function Header({ date, setDate, range, setRange }: { date: string; setDate: (d: string)=>void; range: RangeKey; setRange:(r:RangeKey)=>void }) {
  return (
    <div className="flex flex-col gap-3 mb-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="h1">Przychód z net-billingu</div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="card px-3 py-2 outline-none"
            value={date}
            max={dayjs().format("YYYY-MM-DD")}
            onChange={(e)=> setDate(e.target.value)}
          />
        </div>
      </div>
      <RangeChips range={range} setDate={setDate} setRange={setRange} />
    </div>
  )
}
