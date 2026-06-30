'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { formatDateDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  payment_status?: string | null;
  resource_name?: string | null;
  note?: string | null;
  service_id?: string | null;
  branch_id?: string | null;
  branches?: { branch_name: string } | null;
  services?: { service_name: string } | null;
  customers?: { full_name: string; phone: string } | null;
};

type Branch   = { id: string; branch_name: string };
type Service  = { id: string; service_name: string; price?: number | null };
type LineUser = { id: string; line_user_id: string; display_name: string | null; picture_url?: string | null };
type Resource = { id: string; resource_name: string; resource_code?: string | null; capacity: number; resource_type: string; branch_id?: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'รออนุมัติ',      cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'ยืนยันแล้ว',     cls: 'bg-blue-100   text-blue-700'   },
  waiting:   { label: 'รอเรียก',         cls: 'bg-orange-100 text-orange-700' },
  serving:   { label: 'กำลังบริการ',    cls: 'bg-purple-100 text-purple-700' },
  completed: { label: 'เสร็จสิ้น',      cls: 'bg-green-100  text-green-700'  },
  cancelled: { label: 'ยกเลิก',         cls: 'bg-red-100    text-red-600'    },
  no_show:   { label: 'ไม่มาตามนัด',   cls: 'bg-slate-100  text-slate-500'  },
};

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  unpaid:          { label: 'ยังไม่ชำระ',   cls: 'bg-slate-100  text-slate-500'  },
  pending_payment: { label: 'รอชำระ',        cls: 'bg-amber-100  text-amber-700'  },
  paid:            { label: 'ชำระแล้ว',     cls: 'bg-green-100  text-green-700'  },
  failed:          { label: 'ชำระไม่สำเร็จ', cls: 'bg-red-100   text-red-600'    },
  refunded:        { label: 'คืนเงินแล้ว',  cls: 'bg-purple-100 text-purple-600' },
};

// Next status transitions available per current status
const NEXT_STATUSES: Record<string, Array<{ status: string; label: string; cls: string }>> = {
  pending:   [{ status: 'confirmed', label: 'ยืนยัน',     cls: 'btn-primary' }, { status: 'no_show', label: 'ไม่มา', cls: 'btn-outline' }],
  confirmed: [{ status: 'waiting',   label: 'รอเรียก',    cls: 'btn-primary' }],
  waiting:   [{ status: 'serving',   label: 'เริ่มบริการ', cls: 'btn-primary' }],
  serving:   [{ status: 'completed', label: 'เสร็จสิ้น',  cls: 'btn-primary' }],
};
const CANCELLABLE = new Set(['pending', 'confirmed', 'waiting', 'serving']);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

function PaymentBadge({ status }: { status: string }) {
  const b = PAYMENT_BADGE[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_DRAFT = {
  branch_id: '', service_id: '', booking_date: '', start_time: '',
  party_size: '', resource_id: '', customer_name: '', customer_phone: '', note: '',
};

export function BookingsCrud() {
  const { push } = useToast();

  // ── List state ──
  const [bookings, setBookings]   = useState<BookingRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pageSize]                = useState(20);
  const [loading, setLoading]     = useState(false);

  // ── Filter state ──
  const [filterDate,   setFilterDate]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // ── Reference data ──
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [services,  setServices]  = useState<Service[]>([]);
  const [lineUsers, setLineUsers] = useState<LineUser[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // ── Create drawer ──
  const [createOpen,       setCreateOpen]       = useState(false);
  const [createStep,       setCreateStep]       = useState<1 | 2 | 3>(1);
  const [selectedLineUser, setSelectedLineUser] = useState('');
  const [draft,            setDraft]            = useState(EMPTY_DRAFT);
  const [lastResult,       setLastResult]       = useState<{ queueNo: string; branch: string; service: string; date: string; time: string } | null>(null);

  // ── Edit drawer ──
  const [editTarget,     setEditTarget]     = useState<BookingRow | null>(null);
  const [editDate,       setEditDate]       = useState('');
  const [editTime,       setEditTime]       = useState('');
  const [confirmCancel,  setConfirmCancel]  = useState(false);
  const [saving,         setSaving]         = useState(false);

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadBookings = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: String(pageSize) });
      if (filterDate)   params.set('date',   filterDate);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSearch) params.set('q',      filterSearch);
      const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
      const j = await res.json() as { data?: BookingRow[]; pagination?: { total: number } };
      setBookings(j.data ?? []);
      setTotal(j.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterDate, filterStatus, filterSearch]);

  const loadRefs = useCallback(async () => {
    const [brRes, sRes, uRes, rRes] = await Promise.all([
      fetch('/api/branches',              { cache: 'no-store' }),
      fetch('/api/services',              { cache: 'no-store' }),
      fetch('/api/chat-inbox?page_size=100', { cache: 'no-store' }),
      fetch('/api/resources?page_size=500',  { cache: 'no-store' }),
    ]);
    const [br, s, u, r] = await Promise.all([brRes.json(), sRes.json(), uRes.json(), rRes.json()]) as [
      { data?: Branch[] }, { data?: Service[] }, { data?: { users?: LineUser[] } }, { data?: Resource[] }
    ];
    setBranches(br.data ?? []);
    setServices(s.data  ?? []);
    setLineUsers(u.data?.users ?? []);
    setResources(r.data ?? []);
  }, []);

  useEffect(() => { void loadRefs(); }, [loadRefs]);
  useEffect(() => { void loadBookings(1); setPage(1); }, [filterDate, filterStatus, filterSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadBookings(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Create ─────────────────────────────────────────────────────────────────

  async function submitCreate() {
    const payload: Record<string, unknown> = { ...draft };
    const selected = lineUsers.find((x) => x.id === selectedLineUser);
    if (selected) {
      payload.line_user_pk          = selected.id;
      payload.line_user_external_id = selected.line_user_id;
      if (!String(payload.customer_name ?? '').trim() && selected.display_name)
        payload.customer_name = selected.display_name;
    }

    const res = await fetch('/api/bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const j = await res.json() as { data?: { queue_number?: string; line_push_sent?: boolean; line_push_error?: string }; error?: string };

    if (!res.ok) { push(j.error ?? 'เพิ่มคิวไม่สำเร็จ', 'error'); return; }

    if (j.data?.line_push_sent)     push('เพิ่มคิวสำเร็จ และส่งข้อความ LINE แล้ว');
    else if (selected)              push(`เพิ่มคิวสำเร็จ แต่ส่ง LINE ไม่สำเร็จ: ${j.data?.line_push_error ?? '-'}`, 'error');
    else                            push('เพิ่มคิวสำเร็จ');

    setLastResult({
      queueNo: String(j.data?.queue_number ?? '-'),
      branch:  String(branches.find((b) => b.id === draft.branch_id)?.branch_name  ?? '-'),
      service: String(services.find((s) => s.id === draft.service_id)?.service_name ?? '-'),
      date:    draft.booking_date,
      time:    draft.start_time,
    });
    setCreateStep(3);
    void loadBookings(1); setPage(1);
  }

  // ─── Reschedule ─────────────────────────────────────────────────────────────

  async function submitReschedule() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch('/api/bookings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: editTarget.id, booking_date: editDate, start_time: editTime }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { push(j.error ?? 'เลื่อนนัดไม่สำเร็จ', 'error'); return; }
      push('เลื่อนนัดสำเร็จ');
      setEditTarget(null);
      void loadBookings(page);
    } finally {
      setSaving(false);
    }
  }

  // ─── Status update ───────────────────────────────────────────────────────────

  async function updateStatus(id: string, status: string, fromEditDrawer = false) {
    setSaving(true);
    try {
      const res = await fetch('/api/bookings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, status }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { push(j.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error'); return; }
      push('อัปเดตสถานะแล้ว');
      if (fromEditDrawer) setEditTarget(null);
      void loadBookings(page);
    } finally {
      setSaving(false);
    }
  }

  // ─── Open edit drawer ────────────────────────────────────────────────────────

  function openEdit(b: BookingRow) {
    setEditTarget(b);
    setEditDate(b.booking_date);
    setEditTime(b.start_time.slice(0, 5));
    setConfirmCancel(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 mr-auto">รายการคิว ({total})</h3>
        <button className="btn-primary text-sm" onClick={() => { setCreateOpen(true); setCreateStep(1); setDraft(EMPTY_DRAFT); setSelectedLineUser(''); setLastResult(null); }}>
          + เพิ่มคิวใหม่
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          className="input text-sm w-40"
          value={filterDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterDate(e.target.value)}
          placeholder="วันที่"
        />
        <button className="btn-outline text-xs px-2 py-1" onClick={() => setFilterDate(getTodayISOInBangkok())}>วันนี้</button>
        <button className="btn-outline text-xs px-2 py-1" onClick={() => setFilterDate('')}>ทั้งหมด</button>
        <select className="input text-sm w-36" value={filterStatus} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_BADGE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          className="input text-sm w-40"
          value={filterSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterSearch(e.target.value)}
          placeholder="ค้นหาเลขคิว…"
        />
      </div>

      {/* ── Table ── */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">กำลังโหลด…</p>
        ) : bookings.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">ไม่มีข้อมูลการจอง</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">คิว</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">วันที่ / เวลา</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">ลูกค้า</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 hidden sm:table-cell">บริการ / สาขา</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">สถานะ</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 hidden md:table-cell">ชำระ</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const nextOpts = NEXT_STATUSES[b.status] ?? [];
                return (
                  <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-900">{b.queue_number}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>{formatDateDMY(b.booking_date)}</div>
                      <div className="text-slate-400 text-xs">{b.start_time.slice(0, 5)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{(b.customers as { full_name?: string } | null)?.full_name ?? '-'}</div>
                      <div className="text-slate-400 text-xs">{(b.customers as { phone?: string } | null)?.phone ?? ''}</div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div>{(b.services as { service_name?: string } | null)?.service_name ?? '-'}</div>
                      <div className="text-slate-400 text-xs">{(b.branches as { branch_name?: string } | null)?.branch_name ?? ''}</div>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <PaymentBadge status={String(b.payment_status ?? 'unpaid')} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {/* Quick next-status buttons */}
                        {nextOpts.map((opt) => (
                          <button
                            key={opt.status}
                            className="btn-outline text-xs px-2 py-0.5"
                            onClick={() => void updateStatus(b.id, opt.status)}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {/* Edit / reschedule button */}
                        <button className="btn-outline text-xs px-2 py-0.5" onClick={() => openEdit(b)}>
                          ✏️ แก้ไข
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {total > pageSize && (
        <TablePaginationControls
          page={page}
          rowsPerPage={pageSize}
          total={total}
          onPageChange={(p) => setPage(p)}
          onRowsPerPageChange={() => {}}
        />
      )}

      {/* ════════════════════════════════════
          CREATE DRAWER
      ════════════════════════════════════ */}
      {createOpen && (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setCreateOpen(false)} aria-label="Close" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full sm:w-[60%] bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h4 className="text-base font-semibold">เพิ่มคิวใหม่</h4>
              <button className="btn-outline text-sm" onClick={() => setCreateOpen(false)}>ปิด</button>
            </div>

            {/* Step indicator */}
            <div className="grid grid-cols-3 gap-2 px-5 pt-4">
              {(['1) ลูกค้า', '2) วันเวลา', '3) เสร็จสิ้น'] as const).map((label, i) => (
                <div key={label} className={`text-center text-xs py-1 rounded ${createStep === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {label}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Step 1: service + customer */}
              {createStep === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm space-y-1">
                    <span className="text-slate-600">LINE User (ส่งยืนยันอัตโนมัติ)</span>
                    <select className="input w-full" value={selectedLineUser} onChange={(e) => setSelectedLineUser(e.target.value)}>
                      <option value="">ไม่เลือก</option>
                      {lineUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name ?? 'LINE User'} ({u.line_user_id.slice(0, 8)}…)</option>
                      ))}
                    </select>
                  </label>
                  <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))} required>
                    <option value="">เลือกสาขา</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                  </select>
                  <select className="input" value={draft.service_id} onChange={(e) => setDraft((p) => ({ ...p, service_id: e.target.value }))} required>
                    <option value="">เลือกบริการ</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.service_name}{s.price ? ` — ฿${s.price}` : ''}
                      </option>
                    ))}
                  </select>
                  <input className="input" value={draft.customer_name}  onChange={(e) => setDraft((p) => ({ ...p, customer_name:  e.target.value }))} placeholder="ชื่อลูกค้า *" required />
                  <input className="input" value={draft.customer_phone} onChange={(e) => setDraft((p) => ({ ...p, customer_phone: e.target.value }))} placeholder="เบอร์โทร *"  required />
                  <div className="sm:col-span-2 flex gap-2 pt-2">
                    <button
                      className="btn-primary"
                      disabled={!draft.branch_id || !draft.service_id || !draft.customer_name || !draft.customer_phone}
                      onClick={() => setCreateStep(2)}
                    >ถัดไป: วันเวลา</button>
                    <button className="btn-outline" onClick={() => setCreateOpen(false)}>ยกเลิก</button>
                  </div>
                </div>
              )}

              {/* Step 2: date + time + resource */}
              {createStep === 2 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">วันที่</label>
                    <input className="input w-full" type="date" value={draft.booking_date} onChange={(e) => setDraft((p) => ({ ...p, booking_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">เวลาเริ่ม</label>
                    <input className="input w-full" type="time" value={draft.start_time} onChange={(e) => setDraft((p) => ({ ...p, start_time: e.target.value }))} required />
                  </div>
                  <input className="input" type="number" min={1} max={200} value={draft.party_size} onChange={(e) => setDraft((p) => ({ ...p, party_size: e.target.value }))} placeholder="จำนวนคน (Party Size)" />
                  <select className="input" value={draft.resource_id} onChange={(e) => setDraft((p) => ({ ...p, resource_id: e.target.value }))}>
                    <option value="">เลือกทรัพยากร (ถ้ามี)</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>{r.resource_code ? `${r.resource_code} • ` : ''}{r.resource_name} (cap {r.capacity})</option>
                    ))}
                  </select>
                  <input className="input sm:col-span-2" value={draft.note} onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))} placeholder="หมายเหตุ" />
                  <div className="sm:col-span-2 flex gap-2 pt-2">
                    <button className="btn-outline" onClick={() => setCreateStep(1)}>ย้อนกลับ</button>
                    <button
                      className="btn-primary"
                      disabled={!draft.booking_date || !draft.start_time}
                      onClick={() => void submitCreate()}
                    >ยืนยันสร้างคิว</button>
                  </div>
                </div>
              )}

              {/* Step 3: result */}
              {createStep === 3 && lastResult && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2 text-sm">
                  <h5 className="text-base font-semibold text-green-700">✓ สร้างคิวสำเร็จ</h5>
                  <p>เลขคิว: <b className="text-lg">{lastResult.queueNo}</b></p>
                  <p>บริการ: {lastResult.service}</p>
                  <p>สาขา: {lastResult.branch}</p>
                  <p>วันที่: {formatDateDMY(lastResult.date)}</p>
                  <p>เวลา: {lastResult.time}</p>
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    <button className="btn-outline" onClick={() => { setCreateStep(1); setDraft(EMPTY_DRAFT); setSelectedLineUser(''); }}>จองคิวใหม่</button>
                    <button className="btn-primary" onClick={() => setCreateOpen(false)}>เสร็จสิ้น</button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ════════════════════════════════════
          EDIT / RESCHEDULE DRAWER
      ════════════════════════════════════ */}
      {editTarget && (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setEditTarget(null)} aria-label="Close" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full sm:w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h4 className="text-base font-semibold">แก้ไขคิว {editTarget.queue_number}</h4>
                <p className="text-xs text-slate-500">
                  {(editTarget.customers as { full_name?: string } | null)?.full_name ?? '-'} •{' '}
                  {(editTarget.services  as { service_name?: string } | null)?.service_name ?? '-'}
                </p>
              </div>
              <button className="btn-outline text-sm" onClick={() => setEditTarget(null)}>ปิด</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

              {/* Current info */}
              <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-1">
                <div className="flex gap-2">
                  <StatusBadge  status={editTarget.status} />
                  <PaymentBadge status={String(editTarget.payment_status ?? 'unpaid')} />
                </div>
                <p className="text-slate-600 pt-1">
                  วันที่เดิม: <b>{formatDateDMY(editTarget.booking_date)}</b> เวลา <b>{editTarget.start_time.slice(0, 5)}</b>
                </p>
                {editTarget.resource_name && <p className="text-slate-500 text-xs">ทรัพยากร: {editTarget.resource_name}</p>}
              </div>

              {/* ── Reschedule section ── */}
              <section className="space-y-3">
                <h5 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-1">📅 เปลี่ยนวัน / เวลา</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">วันที่ใหม่</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">เวลาใหม่</label>
                    <input
                      type="time"
                      className="input w-full"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={saving || (!editDate && !editTime)}
                  onClick={() => void submitReschedule()}
                >
                  {saving ? 'กำลังบันทึก…' : 'บันทึกวันเวลาใหม่'}
                </button>
              </section>

              {/* ── Status transition section ── */}
              {(NEXT_STATUSES[editTarget.status] ?? []).length > 0 && (
                <section className="space-y-3">
                  <h5 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-1">🔄 เปลี่ยนสถานะ</h5>
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_STATUSES[editTarget.status] ?? []).map((opt) => (
                      <button
                        key={opt.status}
                        className="btn-primary flex-1"
                        disabled={saving}
                        onClick={() => void updateStatus(editTarget.id, opt.status, true)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Cancel section ── */}
              {CANCELLABLE.has(editTarget.status) && (
                <section className="space-y-3">
                  <h5 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-1">⚠️ ยกเลิกการจอง</h5>
                  {!confirmCancel ? (
                    <button
                      className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
                      onClick={() => setConfirmCancel(true)}
                    >
                      ยกเลิกการจองนี้
                    </button>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                      <p className="text-sm text-red-700 font-medium">ยืนยันการยกเลิก?</p>
                      <p className="text-xs text-red-500">คิว {editTarget.queue_number} จะถูกยกเลิกและแจ้งเตือนไปยังระบบ</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          disabled={saving}
                          onClick={() => void updateStatus(editTarget.id, 'cancelled', true)}
                        >
                          {saving ? 'กำลังยกเลิก…' : 'ใช่ ยกเลิกการจอง'}
                        </button>
                        <button className="flex-1 btn-outline" onClick={() => setConfirmCancel(false)}>
                          ไม่ใช่
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

            </div>
          </aside>
        </>
      )}
    </div>
  );
}
