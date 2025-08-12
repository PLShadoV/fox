import React from "react";

export default function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      {(title || subtitle || right) && (
        <header className="mb-3 flex items-center justify-between">
          <div>
            {title && <div className="h2">{title}</div>}
            {subtitle && <div className="muted text-sm">{subtitle}</div>}
          </div>
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
