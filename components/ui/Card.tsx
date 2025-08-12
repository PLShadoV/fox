export default function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;   // slot na akcje po prawej
  children: React.ReactNode;
}) {
  return (
    <div className="card-glass p-5">
      {(title || right) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <div className="text-sm font-medium text-white/80">{title}</div>
            )}
            {subtitle && (
              <div className="text-xs text-white/60">{subtitle}</div>
            )}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
