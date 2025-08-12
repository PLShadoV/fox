'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/foxess", label: "FoxESS" },
  { href: "/prices", label: "Ceny" },
  { href: "/history", label: "Historia" },
  { href: "/diagnostics", label: "Diagnostyka" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
      <div className="text-sm font-medium">⚡ NetBilling</div>
      <div className="flex gap-1 overflow-x-auto">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 text-sm rounded-xl hover:bg-white/10 ${pathname===l.href ? 'bg-white/15' : 'bg-transparent'}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
