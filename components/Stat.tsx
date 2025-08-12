export default function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="muted text-xs">{label}</div>
      <div className="text-xl font-semibold">
        {value}
        {unit ? <span className="ml-1 text-sm text-white/70">{unit}</span> : null}
      </div>
    </div>
  );
}
