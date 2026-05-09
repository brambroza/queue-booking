'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Booking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
  customers: { full_name?: string } | null;
  services: { service_name?: string } | null;
};

const cols: Array<Booking['status']> = ['confirmed', 'waiting', 'serving', 'completed'];

export function QueueBoardClient() {
  const { push } = useToast();
  const [rows, setRows] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings?date=${date}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดคิวไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }, [date, push]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(id: string, status: Booking['status']) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return push('เปลี่ยนสถานะไม่สำเร็จ', 'error');
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="text-sm">Date<input className="input mt-1 max-w-[220px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {cols.map((col) => (
          <section key={col} className="card p-3">
            <h3 className="mb-2 text-sm font-semibold uppercase">{col}</h3>
            <div className="space-y-2">
              {rows.filter((r) => r.status === col).map((r) => (
                <article key={r.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                  <p className="font-semibold">{r.queue_number}</p>
                  <p>{String(r.start_time).slice(0, 5)} - {r.customers?.full_name ?? '-'}</p>
                  <p className="text-xs text-slate-600">{r.services?.service_name ?? '-'}</p>
                  <div className="mt-2 flex gap-1">
                    {col !== 'waiting' ? <button className="btn-outline" onClick={() => void setStatus(r.id, 'waiting')}>Waiting</button> : null}
                    {col !== 'serving' ? <button className="btn-outline" onClick={() => void setStatus(r.id, 'serving')}>Serving</button> : null}
                    {col !== 'completed' ? <button className="btn-primary" onClick={() => void setStatus(r.id, 'completed')}>Complete</button> : null}
                  </div>
                </article>
              ))}
              {rows.filter((r) => r.status === col).length === 0 ? <p className="text-xs text-slate-400">ไม่มีคิว</p> : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
