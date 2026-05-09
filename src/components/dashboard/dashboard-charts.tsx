'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type DashboardData = {
  totals: { branches: number; services: number; bookings: number };
  by_day: Array<{ date: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
};

export function DashboardCharts() {
  const { push } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'โหลด dashboard ไม่สำเร็จ', 'error');
      setData(json.data);
    })();
  }, [push]);

  const max = useMemo(() => Math.max(...(data?.by_day.map((x) => x.count) ?? [1]), 1), [data]);

  const points = useMemo(() => {
    if (!data) return '';
    return data.by_day
      .map((p, i) => {
        const x = (i / Math.max(data.by_day.length - 1, 1)) * 100;
        const y = 100 - (p.count / max) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, max]);

  if (!data) return <div className="card p-4 text-sm">กำลังโหลด dashboard...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-sm text-slate-500">Branches</p><p className="text-2xl font-bold">{data.totals.branches}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Services</p><p className="text-2xl font-bold">{data.totals.services}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Bookings</p><p className="text-2xl font-bold">{data.totals.bookings}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="mb-2 font-semibold">Bookings Trend (14 days)</h3>
          <svg viewBox="0 0 100 100" className="h-48 w-full rounded bg-slate-50">
            <polyline fill="none" stroke="#0f6fff" strokeWidth="2" points={points} />
          </svg>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500 sm:grid-cols-4">
            {data.by_day.slice(-8).map((d) => <span key={d.date}>{d.date.slice(5)}: {d.count}</span>)}
          </div>
        </section>

        <section className="card p-4">
          <h3 className="mb-2 font-semibold">Bookings by Status</h3>
          <div className="space-y-2">
            {data.by_status.length === 0 ? <p className="text-sm text-slate-500">ไม่มีข้อมูล</p> : data.by_status.map((s) => {
              const width = `${(s.count / Math.max(...data.by_status.map((x) => x.count), 1)) * 100}%`;
              return (
                <div key={s.status}>
                  <div className="mb-1 flex justify-between text-sm"><span>{s.status}</span><span>{s.count}</span></div>
                  <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-500" style={{ width }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
