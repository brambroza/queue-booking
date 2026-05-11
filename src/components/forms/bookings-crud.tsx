'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { formatDateDMY } from '@/lib/utils/date-format';

type LineUser = { id: string; line_user_id: string; display_name: string | null; picture_url?: string | null };
type Resource = { id: string; resource_name: string; resource_code?: string | null; capacity: number; resource_type: string; branch_id?: string | null };

export function BookingsCrud() {
  const { push } = useToast();
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [branches, setBranches] = useState<Record<string, unknown>[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [lineUsers, setLineUsers] = useState<LineUser[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLineUser, setSelectedLineUser] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  async function load() {
    const [bRes, brRes, sRes, uRes, rRes] = await Promise.all([
      fetch('/api/bookings', { cache: 'no-store' }),
      fetch('/api/branches', { cache: 'no-store' }),
      fetch('/api/services', { cache: 'no-store' }),
      fetch('/api/chat-inbox?page_size=100', { cache: 'no-store' }),
      fetch('/api/resources?page_size=500', { cache: 'no-store' }),
    ]);
    const [b, br, s, u, r] = await Promise.all([bRes.json(), brRes.json(), sRes.json(), uRes.json(), rRes.json()]);
    setBookings(b.data ?? []);
    setBranches(br.data ?? []);
    setServices(s.data ?? []);
    setLineUsers(u.data?.users ?? []);
    setResources(r.data ?? []);
  }
  const pagedRows = bookings.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => { void load(); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, FormDataEntryValue>;
    const selected = lineUsers.find((x) => x.id === selectedLineUser);
    if (selected) {
      payload.line_user_pk = selected.id;
      payload.line_user_external_id = selected.line_user_id;
      if (!String(payload.customer_name ?? '').trim() && selected.display_name) payload.customer_name = selected.display_name;
    }
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) {
      push(j.error ?? 'เพิ่มคิวไม่สำเร็จ', 'error');
      return;
    }
    if (j.data?.line_push_sent) {
      push('เพิ่มคิวสำเร็จ และส่งข้อความ LINE แล้ว');
    } else if (selected) {
      push(`เพิ่มคิวสำเร็จ แต่ส่ง LINE ไม่สำเร็จ: ${j.data?.line_push_error ?? '-'}`, 'error');
    } else {
      push('เพิ่มคิวสำเร็จ');
    }
    form.reset();
    setSelectedLineUser('');
    setDrawerOpen(false);
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">รายการคิว</h3>
        <button className="btn-primary" onClick={() => setDrawerOpen(true)}>Add New</button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {bookings.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีคิว</p> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Queue</th>
                <th className="px-2 py-2 text-left">วันที่</th>
                <th className="px-2 py-2 text-left">เวลา</th>
                <th className="px-2 py-2 text-left">ลูกค้า</th>
                <th className="px-2 py-2 text-left">Resource</th>
                <th className="px-2 py-2 text-left">สถานะ</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>{pagedRows.map((b) => (
              <tr key={String(b.id)} className="border-t border-slate-100">
                <td className="px-2 py-2">{String(b.queue_number)}</td>
                <td className="px-2 py-2">{formatDateDMY(String(b.booking_date ?? ''))}</td>
                <td className="px-2 py-2">{String(b.start_time)}</td>
                <td className="px-2 py-2">{String((b.customers as { full_name?: string } | null)?.full_name ?? '-')}</td>
                <td className="px-2 py-2">{String(b.resource_name ?? '-')}</td>
                <td className="px-2 py-2">{String(b.status)}</td>
                <td className="px-2 py-2">
                  <ActionIconGroup
                    actions={[
                      {
                        key: 'complete',
                        icon: <DoneAllIcon fontSize="small" />,
                        labelKey: 'bookings.complete',
                        fallbackLabel: 'Complete',
                        color: 'success',
                        onClick: () => void updateStatus(String(b.id), 'completed'),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {bookings.length > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={bookings.length}
            onPageChange={setPage}
            onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full bg-white p-5 shadow-2xl sm:w-[60%] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">เพิ่มคิวใหม่</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm space-y-1">
                <span className="text-slate-600">LINE User (สำหรับส่งยืนยันอัตโนมัติ)</span>
                <select className="input" value={selectedLineUser} onChange={(e) => setSelectedLineUser(e.target.value)}>
                  <option value="">ไม่เลือก</option>
                  {lineUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name || 'LINE User'} ({u.line_user_id})</option>
                  ))}
                </select>
              </label>
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
              <input className="input" name="party_size" type="number" min={1} max={200} placeholder="จำนวนคน (Party Size)" />
              <select className="input" name="resource_id">
                <option value="">เลือกทรัพยากร (ถ้ามี)</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.resource_code ? `${r.resource_code} • ` : ''}{r.resource_name} ({r.resource_type}, cap {r.capacity})
                  </option>
                ))}
              </select>
              <input className="input sm:col-span-2" name="note" placeholder="หมายเหตุ" />
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary">เพิ่มคิว</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
