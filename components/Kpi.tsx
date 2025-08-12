import React from "react";
import clsx from "clsx";

export default function Kpi({ label, value, suffix, sub }: { label: string; value: string | number; suffix?: string; sub?: string; }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="kpi mt-1">{value}{suffix ? <span className="text-base font-medium ml-1">{suffix}</span> : null}</div>
      {sub ? <div className="kpi-sub mt-1">{sub}</div> : null}
    </div>
  )
}
