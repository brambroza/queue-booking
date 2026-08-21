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
  by_staff: Array<{ name: string; count: number; completed: number; cancelled: number; no_show: number }>;
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
        <a className="btn-outline" href={`/api/reports?from=${from}&to=${to}&mode=csv&group=staff`}>Export CSV (รายผู้ให้บริการ)</a>
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

          <section className="card p-4">
            <h3 className="font-semibold">รายผู้ให้บริการ / เทรนเนอร์</h3>
            {(data.by_staff ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ยังไม่มีคิวในช่วงที่เลือก</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">ชื่อ</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">คิวทั้งหมด</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">เสร็จสิ้น</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">ยกเลิก</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">ไม่มาตามนัด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_staff.map((s) => (
                      <tr key={s.name} className="border-t border-slate-100">
                        <td className="px-2 py-2">{s.name}</td>
                        <td className="px-2 py-2">{s.count}</td>
                        <td className="px-2 py-2">{s.completed}</td>
                        <td className="px-2 py-2">{s.cancelled}</td>
                        <td className="px-2 py-2">{s.no_show}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
