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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lastResult, setLastResult] = useState<{ queueNo: string; branch: string; service: string; date: string; time: string } | null>(null);

  const [draft, setDraft] = useState({
    branch_id: '',
    service_id: '',
    booking_date: '',
    start_time: '',
    party_size: '',
    resource_id: '',
    customer_name: '',
    customer_phone: '',
    note: '',
  });

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

  async function submitBooking() {
    const payload = { ...draft } as Record<string, FormDataEntryValue>;
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
    const branchName = String(branches.find((b) => String(b.id) === draft.branch_id)?.branch_name ?? '-');
    const serviceName = String(services.find((s) => String(s.id) === draft.service_id)?.service_name ?? '-');
    setLastResult({
      queueNo: String(j.data?.queue_number ?? '-'),
      branch: branchName,
      service: serviceName,
      date: draft.booking_date,
      time: draft.start_time,
    });
    setStep(3);
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
        <button className="btn-primary" onClick={() => {
          setDrawerOpen(true);
          setStep(1);
          setLastResult(null);
          setDraft({ branch_id: '', service_id: '', booking_date: '', start_time: '', party_size: '', resource_id: '', customer_name: '', customer_phone: '', note: '' });
          setSelectedLineUser('');
        }}>Add New</button>
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

            <div className="mb-3 grid grid-cols-3 gap-2">
              <button className={step === 1 ? 'btn-primary' : 'btn-outline'} disabled>1) Service</button>
              <button className={step === 2 ? 'btn-primary' : 'btn-outline'} disabled>2) Date/Time</button>
              <button className={step === 3 ? 'btn-primary' : 'btn-outline'} disabled>3) Result</button>
            </div>

            {step === 1 ? (
              <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm space-y-1">
                <span className="text-slate-600">LINE User (สำหรับส่งยืนยันอัตโนมัติ)</span>
                <select className="input" value={selectedLineUser} onChange={(e) => setSelectedLineUser(e.target.value)}>
                  <option value="">ไม่เลือก</option>
                  {lineUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name || 'LINE User'} ({u.line_user_id})</option>
                  ))}
                </select>
              </label>
              <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))} required>
                <option value="">เลือกสาขา</option>
                {branches.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.branch_name)}</option>)}
              </select>
              <select className="input" value={draft.service_id} onChange={(e) => setDraft((p) => ({ ...p, service_id: e.target.value }))} required>
                <option value="">เลือกบริการ</option>
                {services.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.service_name)}</option>)}
              </select>
              <input className="input" value={draft.customer_name} onChange={(e) => setDraft((p) => ({ ...p, customer_name: e.target.value }))} placeholder="ชื่อลูกค้า" required />
              <input className="input" value={draft.customer_phone} onChange={(e) => setDraft((p) => ({ ...p, customer_phone: e.target.value }))} placeholder="เบอร์โทร" required />
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button
                  className="btn-primary"
                  disabled={!draft.branch_id || !draft.service_id || !draft.customer_name || !draft.customer_phone}
                  onClick={() => setStep(2)}
                >
                  ถัดไป: Date/Time
                </button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" value={draft.booking_date} onChange={(e) => setDraft((p) => ({ ...p, booking_date: e.target.value }))} type="date" required />
              <input className="input" value={draft.start_time} onChange={(e) => setDraft((p) => ({ ...p, start_time: e.target.value }))} type="time" required />
              <input className="input" value={draft.party_size} onChange={(e) => setDraft((p) => ({ ...p, party_size: e.target.value }))} type="number" min={1} max={200} placeholder="จำนวนคน (Party Size)" />
              <select className="input" value={draft.resource_id} onChange={(e) => setDraft((p) => ({ ...p, resource_id: e.target.value }))}>
                <option value="">เลือกทรัพยากร (ถ้ามี)</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.resource_code ? `${r.resource_code} • ` : ''}{r.resource_name} ({r.resource_type}, cap {r.capacity})
                  </option>
                ))}
              </select>
              <input className="input sm:col-span-2" value={draft.note} onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))} placeholder="หมายเหตุ" />
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-outline" onClick={() => setStep(1)}>ย้อนกลับ</button>
                <button
                  className="btn-primary"
                  disabled={!draft.booking_date || !draft.start_time}
                  onClick={() => void submitBooking()}
                >
                  ยืนยันสร้างคิว
                </button>
              </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <h5 className="text-lg font-semibold text-slate-900">สร้างคิวสำเร็จ</h5>
                <p className="mt-2">เลขคิว: <b>{lastResult?.queueNo ?? '-'}</b></p>
                <p>บริการ: {lastResult?.service ?? '-'}</p>
                <p>สาขา: {lastResult?.branch ?? '-'}</p>
                <p>วันที่: {lastResult?.date ? formatDateDMY(lastResult.date) : '-'}</p>
                <p>เวลา: {lastResult?.time ?? '-'}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-outline" onClick={() => setStep(1)}>จองคิวใหม่</button>
                  <button className="btn-primary" onClick={() => setDrawerOpen(false)}>เสร็จสิ้น</button>
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}
