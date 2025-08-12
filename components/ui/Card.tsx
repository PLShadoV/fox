export default function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="card-glass p-5">
      {title ? <div className="mb-3 text-sm font-medium text-white/80">{title}</div> : null}
      {children}
    </div>
  );
}
