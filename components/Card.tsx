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
    <div className="card-glass p-5">
      {(title || right || subtitle) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title ? <div className="text-sm font-medium text-white/90">{title}</div> : null}
            {subtitle ? <div className="muted text-xs">{subtitle}</div> : null}
          </div>
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
