"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/prices", label: "Ceny" },
  { href: "/diagnostics", label: "Diagnostyka" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur">
      <div className="font-semibold">FoxESS · RCE</div>
      <ul className="flex gap-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`px-3 py-1 rounded-xl transition ${
                  active ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
