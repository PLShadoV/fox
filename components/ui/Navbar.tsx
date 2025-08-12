'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SolarPanel, Zap, Coins, Gauge } from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/foxess', label: 'FoxESS', icon: SolarPanel },
  { href: '/tuya', label: 'Tuya', icon: Zap },
  { href: '/prices', label: 'Ceny', icon: Coins },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="container flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-b from-blue-500/70 to-blue-400/40 border border-white/20 flex items-center justify-center shadow">
          <SolarPanel size={18} />
        </div>
        <div className="font-semibold">Net‑Billing</div>
      </div>
      <nav className="flex gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={clsx("btn", active && "btn-primary")}>
              <Icon size={16} /> <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
