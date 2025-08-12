import { LucideIcon } from "lucide-react";

export default function StatTile({ icon: Icon, label, value, suffix }:
  { icon: LucideIcon; label: string; value: string | number; suffix?: string; }) {
  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm/5 text-white/70">{label}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
          <Icon className="h-4 w-4 text-emerald-400" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">
        {value}{suffix ? <span className="ml-1 text-white/60 text-lg">{suffix}</span> : null}
      </div>
    </div>
  );
}
