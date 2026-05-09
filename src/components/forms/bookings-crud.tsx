'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

export function BookingsCrud() {
  const { push } = useToast();
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [branches, setBranches] = useState<Record<string, unknown>[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);

  async function load() {
    const [bRes, brRes, sRes] = await Promise.all([
      fetch('/api/bookings', { cache: 'no-store' }),
      fetch('/api/branches', { cache: 'no-store' }),
      fetch('/api/services', { cache: 'no-store' }),
    ]);
    const [b, br, s] = await Promise.all([bRes.json(), brRes.json(), sRes.json()]);
    setBookings(b.data ?? []);
    setBranches(br.data ?? []);
    setServices(s.data ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json();
      push(j.error ?? 'เพิ่มคิวไม่สำเร็จ', 'error');
      return;
    }
    push('เพิ่มคิวสำเร็จ');
    form.reset();
    void load();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return push('เปลี่ยนสถานะไม่สำเร็จ', 'error');
    push('อัปเดตสถานะแล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="card p-4 grid gap-3 sm:grid-cols-3">
        <select className="input" name="branch_id" required>
          <option value="">เลือกสาขา</option>
          {branches.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.branch_name)}</option>)}
        </select>
        <select className="input" name="service_id" required>
          <option value="">เลือกบริการ</option>
          {services.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.service_name)}</option>)}
        </select>
        <input className="input" name="customer_name" placeholder="ชื่อลูกค้า" required />
        <input className="input" name="customer_phone" placeholder="เบอร์โทร" required />
        <input className="input" name="booking_date" type="date" required />
        <input className="input" name="start_time" type="time" required />
        <input className="input" name="note" placeholder="หมายเหตุ" />
        <div><button className="btn-primary">เพิ่มคิว</button></div>
      </form>

      <div className="card p-4 overflow-x-auto">
        {bookings.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีคิว</p> : (
          <table className="min-w-full text-sm">
            <thead><tr><th>Queue</th><th>วันที่</th><th>เวลา</th><th>ลูกค้า</th><th>สถานะ</th><th>Action</th></tr></thead>
            <tbody>{bookings.map((b) => (
              <tr key={String(b.id)} className="border-t border-slate-100">
                <td>{String(b.queue_number)}</td>
                <td>{String(b.booking_date)}</td>
                <td>{String(b.start_time)}</td>
                <td>{String((b.customers as { full_name?: string } | null)?.full_name ?? '-')}</td>
                <td>{String(b.status)}</td>
                <td>
                  <button className="btn-outline" onClick={() => void updateStatus(String(b.id), 'completed')}>Complete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
