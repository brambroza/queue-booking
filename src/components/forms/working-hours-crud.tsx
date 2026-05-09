'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

export function WorkingHoursCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [branches, setBranches] = useState<Record<string, unknown>[]>([]);

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
    void load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="card p-4 grid gap-3 sm:grid-cols-3">
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
        <label className="text-sm"><input type="checkbox" name="active" defaultChecked /> active</label>
        <div className="sm:col-span-3"><button className="btn-primary">เพิ่มเวลาทำการ</button></div>
      </form>

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
    </div>
  );
}
