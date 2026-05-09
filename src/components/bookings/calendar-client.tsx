'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Row = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  queue_number: string;
  branches: { branch_name?: string } | null;
  services: { service_name?: string } | null;
  customers: { full_name?: string } | null;
};

export function CalendarClient() {
  const { push } = useToast();
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดปฏิทินไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }, [from, to, push]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const arr = m.get(r.booking_date) ?? [];
      arr.push(r);
      m.set(r.booking_date, arr);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <label className="text-sm">From<input className="input mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input className="input mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      <div className="space-y-3">
        {grouped.length === 0 ? <div className="card p-4 text-sm text-slate-500">ไม่มีคิวในช่วงวันที่เลือก</div> : grouped.map(([date, list]) => (
          <section key={date} className="card p-4">
            <h3 className="font-semibold">{date} ({list.length} คิว)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr><th className="text-left">เวลา</th><th className="text-left">คิว</th><th className="text-left">ลูกค้า</th><th className="text-left">สาขา</th><th className="text-left">บริการ</th><th className="text-left">สถานะ</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td>{String(r.start_time).slice(0, 5)}</td>
                      <td>{r.queue_number}</td>
                      <td>{r.customers?.full_name ?? '-'}</td>
                      <td>{r.branches?.branch_name ?? '-'}</td>
                      <td>{r.services?.service_name ?? '-'}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
