'use client';

import { useEffect, useState } from 'react';

type Notification = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Notification[]>([]);

  async function load() {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    const json = await res.json();
    if (res.ok) setRows(json.data ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((x) => !x)}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg z-40">
          {rows.length === 0 ? <p className="p-2 text-sm text-slate-500">ไม่มีการแจ้งเตือน</p> : rows.map((r) => (
            <button key={r.id} className={`w-full rounded p-2 text-left hover:bg-slate-50 ${r.read_at ? 'opacity-60' : ''}`} onClick={() => void markRead(r.id)}>
              <p className="text-sm font-medium">{r.title}</p>
              {r.body ? <p className="text-xs text-slate-600">{r.body}</p> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
