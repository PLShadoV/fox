
"use client";

import { useEffect, useState } from "react";

type Item = { year:number; monthIndex:number; monthLabel:string; value:number|null };

export default function MonthlyRCEmTable(){
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    let cancelled = false;
    async function load(){
      try{
        setLoading(true);
        const r = await fetch("/api/rcem", { cache: "no-store" });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "Nie udało się pobrać RCEm.");
        if (!cancelled){
          setItems(Array.isArray(j.items) ? j.items : []);
          if (j.source) setNote(`Źródło: ${j.source.toUpperCase()}`);
        }
      }catch(e:any){
        if (!cancelled) setNote(e?.message || String(e));
      }finally{
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return ()=>{ cancelled = true; };
  }, []);

  return (
    <div className="pv-card p-5 glass glass-border">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-lg font-semibold">RCEm — miesięczne ceny [PLN/MWh]</h3>
        {loading && <div className="text-sm opacity-80">Ładowanie…</div>}
      </div>
      <div className="overflow-auto mt-3">
        <table className="w-full text-sm">
          <thead className="text-left opacity-70 border-b" style={{ borderColor: "var(--pv-border)" }}>
            <tr>
              <th className="py-2 pr-4 font-medium">Rok</th>
              <th className="py-2 pr-4 font-medium">Miesiąc</th>
              <th className="py-2 font-medium text-right">RCEm [PLN/MWh]</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((it, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--pv-border)" }}>
                <td className="py-2 pr-4">{it.year}</td>
                <td className="py-2 pr-4 capitalize">{it.monthLabel}</td>
                <td className="py-2 text-right">{it.value != null ? it.value.toFixed(2) : "-"}</td>
              </tr>
            )) : (
              <tr><td className="py-3 opacity-80" colSpan={3}>Brak danych</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {note ? <div className="mt-2 text-xs opacity-70">{note}</div> : null}
    </div>
  );
}
