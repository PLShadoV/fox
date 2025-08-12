export default function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-glass p-5">
      {title ? (
        <div className="mb-3">
          <div className="text-sm font-medium text-white/80">{title}</div>
          {subtitle ? (
            <div className="text-xs text-white/60">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
