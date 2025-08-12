import { ReactNode } from 'react';
export default function Card({ children, title, subtitle, right }: { children: ReactNode; title?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <section className="card">
      {(title || subtitle || right) && (
        <div className="flex items-center justify-between mb-3">
          <div>
            {title && <div className="text-lg font-semibold">{title}</div>}
            {subtitle && <div className="text-xs muted">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
