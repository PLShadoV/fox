"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Gauge, LineChart, Cog } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/prices", label: "Ceny", icon: LineChart },
  { href: "/diagnostics", label: "Diag", icon: Cog },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-emerald-500/80" />
        <div className="text-sm font-medium">FoxESS · RCE</div>
      </div>
      <div className="flex items-center gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "btn",
              pathname === href && "bg-white/20 border-white/20"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
