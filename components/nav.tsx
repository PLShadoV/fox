'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const tabs = [
  { href: '/', label: 'Dashboard' },
  { href: '/foxess', label: 'FoxESS' },
  { href: '/prices', label: 'Ceny' },
  { href: '/history', label: 'Historia' },
  { href: '/diagnostics', label: 'Diagnostyka' },
] as const;

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 mb-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
      <ul className="flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <li key={t.href}>
            <Link
              href={t.href}
              className={clsx(
                'inline-flex items-center rounded-xl px-3 py-1.5 text-sm transition',
                pathname === t.href
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
