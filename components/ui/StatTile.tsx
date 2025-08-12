import { ReactNode } from 'react';

export default function StatTile({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold flex items-center gap-2">{icon}{value}</div>
    </div>
  );
}
