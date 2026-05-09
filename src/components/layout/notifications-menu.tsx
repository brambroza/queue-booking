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
      <button className="btn-outline" onClick={() => setOpen((x) => !x)}>Notifications {unread ? `(${unread})` : ''}</button>
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
