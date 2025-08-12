import Link from "next/link";
import { Bolt, PiggyBank, Upload, Import } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-white/10 lg:bg-black/20 lg:backdrop-blur-md">
      <div className="px-4 py-4">
        <div className="text-sm text-slate-400">Nawigacja</div>
      </div>
      <nav className="px-2 pb-4">
        <ul className="space-y-1">
          <li><Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-white/5"><Bolt className="w-4 h-4" /> Pulpit</Link></li>
          <li><Link href="/foxess" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-white/5"><Upload className="w-4 h-4" /> FoxESS</Link></li>
          <li><Link href="/prices" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-white/5"><PiggyBank className="w-4 h-4" /> Ceny RCE</Link></li>
          <li><Link href="/tuya" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-white/5"><Import className="w-4 h-4" /> Tuya</Link></li>
        </ul>
      </nav>
      <div className="mt-auto p-4 text-xs text-slate-400/80">© {new Date().getFullYear()} NetBilling</div>
    </aside>
  );
}
