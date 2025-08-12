import { ReactNode } from 'react';
export default function Tile({ title, value, hint, icon }: { title: string; value: ReactNode; hint?: string; icon?: ReactNode }){
  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide muted">{title}</div>
        <div className="text-2xl font-semibold">{value}{hint ? <span className="text-sm font-normal ml-1 muted">{hint}</span> : null}</div>
      </div>
      {icon && <div className="opacity-70">{icon}</div>}
    </div>
  );
}
