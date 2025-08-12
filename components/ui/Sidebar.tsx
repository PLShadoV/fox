'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SunMedium, Gauge, Zap, Coins } from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { href: '/history', label: 'Historia', icon: Gauge } ,
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/foxess', label: 'FoxESS', icon: SunMedium },
  { href: '/tuya', label: 'Tuya', icon: Zap },
  { href: '/prices', label: 'Ceny', icon: Coins },
];

export default function Sidebar(){
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo mb-4">
        <SunMedium size={18}/> <b>Net‑Billing</b>
      </div>
      <nav>
        {nav.map(({href,label,icon:Icon}) => (
          <Link key={href} href={href} className={clsx("nav-item", path===href && "active")}>
            <Icon size={16}/> <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
