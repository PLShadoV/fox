import React from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function Card({ title, subtitle, right, children }: CardProps) {
  return (
    <div className="card-glass p-5">
      {(title || subtitle || right) && (
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {subtitle ? <div className="muted text-xs">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
