'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

export function WorkingHoursCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [branches, setBranches] = useState<Record<string, unknown>[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function load() {
    const [hrsRes, brRes] = await Promise.all([fetch('/api/working-hours', { cache: 'no-store' }), fetch('/api/branches', { cache: 'no-store' })]);
    const [hrs, br] = await Promise.all([hrsRes.json(), brRes.json()]);
    setRows(hrs.data ?? []);
    setBranches(br.data ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const res = await fetch('/api/working-hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json();
      push(j.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }
    push('บันทึกสำเร็จ');
    form.reset();
    setDrawerOpen(false);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">รายการเวลาทำการ</h3>
        <button className="btn-primary" onClick={() => setDrawerOpen(true)}>Add New</button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p> : (
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left">สาขา</th><th className="text-left">weekday</th><th className="text-left">เวลา</th><th className="text-left">slot</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={String(r.id)} className="border-t border-slate-100">
                <td>{String((r.branches as { branch_name?: string } | null)?.branch_name ?? '-')}</td>
                <td>{String(r.weekday)}</td>
                <td>{String(r.open_time)} - {String(r.close_time)}</td>
                <td>{String(r.slot_interval_minutes)} นาที</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full bg-white p-5 shadow-2xl sm:w-[60%] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">เพิ่มเวลาทำการ</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <select className="input" name="branch_id" required>
                <option value="">เลือกสาขา</option>
                {branches.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.branch_name)}</option>)}
              </select>
              <input className="input" type="number" name="weekday" min={0} max={6} placeholder="weekday 0-6" required />
              <input className="input" type="time" name="open_time" required defaultValue="09:00" />
              <input className="input" type="time" name="close_time" required defaultValue="18:00" />
              <input className="input" type="time" name="break_start" />
              <input className="input" type="time" name="break_end" />
              <input className="input" type="number" name="slot_interval_minutes" defaultValue={30} required />
              <input className="input" type="number" name="capacity_per_slot" defaultValue={1} required />
              <label className="text-sm flex items-center gap-2"><input type="checkbox" name="active" defaultChecked /> active</label>
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary">เพิ่มเวลาทำการ</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
