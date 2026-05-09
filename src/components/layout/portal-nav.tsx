'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const groups: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/portal/dashboard' },
      { label: 'Bookings', href: '/portal/bookings' },
      { label: 'Calendar', href: '/portal/calendar' },
      { label: 'Queue Board', href: '/portal/queue-board' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { label: 'Branches', href: '/portal/branches' },
      { label: 'Services', href: '/portal/services' },
      { label: 'Working Hours', href: '/portal/working-hours' },
      { label: 'Staff', href: '/portal/staff' },
      { label: 'Customers', href: '/portal/customers' },
      { label: 'LINE Settings', href: '/portal/line-settings' },
      { label: 'Chat Inbox', href: '/portal/chat-inbox' },
      { label: 'Reports', href: '/portal/reports' },
      { label: 'Settings', href: '/portal/settings' },
    ],
  },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.title} className="space-y-2">
          <p className="px-2 text-xs font-semibold tracking-wide text-slate-400">{g.title}</p>
          <div className="space-y-1">
            {g.items.map(({ label, href }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition',
                    active ? 'font-semibold text-emerald-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                  style={active ? { backgroundColor: 'var(--brand-tint)' } : undefined}
                >
                  <span className={clsx('h-2 w-2 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-300')} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
