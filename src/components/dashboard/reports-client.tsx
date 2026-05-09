'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type ReportData = {
  range: { from: string; to: string };
  total: number;
  today: number;
  cancelled: number;
  no_show: number;
  completed: number;
  cancel_rate: number;
  by_day: Array<{ date: string; count: number }>;
  popular_services: Array<{ name: string; count: number }>;
  by_branch: Array<{ name: string; count: number }>;
  customers: { new: number; returning: number };
};

export function ReportsClient() {
  const { push } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports?from=${from}&to=${to}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดรายงานไม่สำเร็จ', 'error');
    setData(json.data);
  }, [from, to, push]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <label className="text-sm">From<input className="input mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input className="input mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <a className="btn-outline" href={`/api/reports?from=${from}&to=${to}&mode=csv`}>Export CSV</a>
      </div>

      {!data ? <div className="card p-4 text-sm">กำลังโหลด...</div> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4"><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold">{data.total}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Cancelled</p><p className="text-xl font-bold">{data.cancelled}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">No-show</p><p className="text-xl font-bold">{data.no_show}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Cancel Rate</p><p className="text-xl font-bold">{data.cancel_rate}%</p></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="card p-4">
              <h3 className="font-semibold">Popular Services</h3>
              <ul className="mt-2 text-sm space-y-1">{data.popular_services.slice(0, 8).map((x) => <li key={x.name}>{x.name}: {x.count}</li>)}</ul>
            </section>
            <section className="card p-4">
              <h3 className="font-semibold">By Branch</h3>
              <ul className="mt-2 text-sm space-y-1">{data.by_branch.slice(0, 8).map((x) => <li key={x.name}>{x.name}: {x.count}</li>)}</ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
