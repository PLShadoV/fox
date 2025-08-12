import { ReactNode } from 'react';
export default function Tile({ title, value, icon, hint }: { title: string; value: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <div className="tile">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide muted">{title}</div>
        {hint && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{hint}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold flex items-center gap-2">{icon}{value}</div>
    </div>
  );
}
