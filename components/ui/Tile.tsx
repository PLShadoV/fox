import { ReactNode } from 'react';
export default function Tile({ title, value, icon, hint }: { title: string; value: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <div className="tile p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide muted">{title}</div>
        {hint && <span className="badge">{hint}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold flex items-center gap-2">{icon}{value}</div>
    </div>
  );
}
