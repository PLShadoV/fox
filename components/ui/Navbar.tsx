"use client";
import Link from "next/link";
import { Zap } from "lucide-react";
import clsx from "clsx";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Pulpit" },
    { href: "/foxess", label: "FoxESS" },
    { href: "/prices", label: "Ceny RCE" },
    { href: "/tuya", label: "Tuya" },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow">
            <Zap className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight">NetBilling</div>
        </div>
        <nav className="flex items-center gap-1">
          {tabs.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "px-3 py-2 rounded-lg text-sm transition",
                pathname === t.href
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
