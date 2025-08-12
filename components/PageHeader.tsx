import { ReactNode } from 'react';

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="container mt-2 mb-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}
