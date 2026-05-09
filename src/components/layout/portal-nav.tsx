'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const menus: Array<{ label: string; href: string }> = [
  { label: 'Dashboard', href: '/portal/dashboard' },
  { label: 'Bookings', href: '/portal/bookings' },
  { label: 'Branches', href: '/portal/branches' },
  { label: 'Services', href: '/portal/services' },
  { label: 'Working Hours', href: '/portal/working-hours' },
  { label: 'Calendar', href: '/portal/calendar' },
  { label: 'Queue Board', href: '/portal/queue-board' },
  { label: 'Staff', href: '/portal/staff' },
  { label: 'Customers', href: '/portal/customers' },
  { label: 'LINE Settings', href: '/portal/line-settings' },
  { label: 'Chat Inbox', href: '/portal/chat-inbox' },
  { label: 'Reports', href: '/portal/reports' },
  { label: 'Settings', href: '/portal/settings' },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {menus.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={clsx('block rounded-lg px-3 py-2 text-sm', pathname === href ? 'bg-brand-100 text-brand-900 font-medium' : 'text-slate-600 hover:bg-slate-100')}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
