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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      {(title || subtitle || right) ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title ? <div className="text-sm font-medium text-white/90">{title}</div> : null}
            {subtitle ? <div className="text-xs text-white/60">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
