import * as React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function Card({ title, subtitle, right, children }: Props) {
  return (
    <div className="card-glass p-5 rounded-2xl border border-white/10 shadow-lg bg-white/[0.03]">
      {(title || subtitle || right) ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-base font-semibold text-white/90">{title}</div> : null}
            {subtitle ? <div className="text-xs text-white/60 mt-0.5">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
