'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { ActionIconGroup } from '@/components/ui/action-icon-group';

type Branch = { id: string; branch_name: string };
type WorkingHour = {
  id: string;
  branch_id: string;
  weekday: number;
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
  slot_interval_minutes: number;
  capacity_per_slot: number;
  active: boolean;
  branches?: { branch_name?: string } | null;
};

type Draft = {
  id?: string;
  branch_id: string;
  weekday: string;
  open_time: string;
  close_time: string;
  break_start: string;
  break_end: string;
  slot_interval_minutes: string;
  capacity_per_slot: string;
  active: boolean;
};

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const EMPTY_DRAFT: Draft = {
  branch_id: '',
  weekday: '1',
  open_time: '09:00',
  close_time: '18:00',
  break_start: '',
  break_end: '',
  slot_interval_minutes: '30',
  capacity_per_slot: '1',
  active: true,
};

export function WorkingHoursCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<WorkingHour[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [hrsRes, brRes] = await Promise.all([fetch('/api/working-hours', { cache: 'no-store' }), fetch('/api/branches', { cache: 'no-store' })]);
    const [hrs, br] = await Promise.all([hrsRes.json(), brRes.json()]);
    if (!hrsRes.ok) return push(hrs.error ?? 'โหลดเวลาทำการไม่สำเร็จ', 'error');
    if (!brRes.ok) return push(br.error ?? 'โหลดสาขาไม่สำเร็จ', 'error');
    setRows((hrs.data ?? []) as WorkingHour[]);
    setBranches((br.data ?? []) as Branch[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, branch_id: branches[0]?.id ?? '' });
    setDrawerOpen(true);
  }

  function openEdit(row: WorkingHour) {
    setDraft({
      id: row.id,
      branch_id: row.branch_id,
      weekday: String(row.weekday),
      open_time: String(row.open_time).slice(0, 5),
      close_time: String(row.close_time).slice(0, 5),
      break_start: row.break_start ? String(row.break_start).slice(0, 5) : '',
      break_end: row.break_end ? String(row.break_end).slice(0, 5) : '',
      slot_interval_minutes: String(row.slot_interval_minutes),
      capacity_per_slot: String(row.capacity_per_slot),
      active: Boolean(row.active),
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      branch_id: draft.branch_id,
      weekday: Number(draft.weekday),
      open_time: draft.open_time,
      close_time: draft.close_time,
      break_start: draft.break_start || null,
      break_end: draft.break_end || null,
      slot_interval_minutes: Number(draft.slot_interval_minutes),
      capacity_per_slot: Number(draft.capacity_per_slot),
      active: draft.active,
    };

    const res = await fetch('/api/working-hours', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.id ? { id: draft.id, ...payload } : payload),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');

    push(draft.id ? 'แก้ไขเวลาทำการแล้ว' : 'เพิ่มเวลาทำการแล้ว');
    setDrawerOpen(false);
    setDraft(EMPTY_DRAFT);
    void load();
  }

  async function onDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/working-hours?id=${deleteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบเวลาทำการแล้ว');
    setDeleteId(null);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">จัดการวันทำงาน</h3>
        <button className="btn-primary" onClick={openCreate}>เพิ่มวันทำงาน</button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">สาขา</th>
                <th className="px-2 py-2 text-left">วัน</th>
                <th className="px-2 py-2 text-left">เวลาเปิด-ปิด</th>
                <th className="px-2 py-2 text-left">พัก</th>
                <th className="px-2 py-2 text-left">Slot</th>
                <th className="px-2 py-2 text-left">ความจุ</th>
                <th className="px-2 py-2 text-left">สถานะ</th>
                <th className="px-2 py-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{r.branches?.branch_name ?? '-'}</td>
                  <td className="px-2 py-2">{WEEKDAYS[r.weekday] ?? r.weekday}</td>
                  <td className="px-2 py-2">{String(r.open_time).slice(0, 5)} - {String(r.close_time).slice(0, 5)}</td>
                  <td className="px-2 py-2">{r.break_start ? `${String(r.break_start).slice(0, 5)} - ${String(r.break_end ?? '').slice(0, 5)}` : '-'}</td>
                  <td className="px-2 py-2">{r.slot_interval_minutes} นาที</td>
                  <td className="px-2 py-2">{r.capacity_per_slot}</td>
                  <td className="px-2 py-2">{r.active ? 'เปิดใช้งาน' : 'ปิด'}</td>
                  <td className="px-2 py-2 text-right">
                    <ActionIconGroup
                      actions={[
                        { key: 'edit', icon: <EditOutlinedIcon fontSize="small" />, labelKey: 'common.edit', fallbackLabel: 'Edit', onClick: () => openEdit(r) },
                        { key: 'delete', icon: <DeleteOutlineIcon fontSize="small" />, labelKey: 'common.delete', fallbackLabel: 'Delete', color: 'error', onClick: () => setDeleteId(r.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={rows.length}
            onPageChange={setPage}
            onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full overflow-y-auto bg-white p-5 shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{draft.id ? 'แก้ไขวันทำงาน' : 'เพิ่มวันทำงาน'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>ปิด</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))} required>
                <option value="">เลือกสาขา</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>

              <select className="input" value={draft.weekday} onChange={(e) => setDraft((p) => ({ ...p, weekday: e.target.value }))} required>
                {WEEKDAYS.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
              </select>

              <input className="input" type="time" value={draft.open_time} onChange={(e) => setDraft((p) => ({ ...p, open_time: e.target.value }))} required />
              <input className="input" type="time" value={draft.close_time} onChange={(e) => setDraft((p) => ({ ...p, close_time: e.target.value }))} required />
              <input className="input" type="time" value={draft.break_start} onChange={(e) => setDraft((p) => ({ ...p, break_start: e.target.value }))} />
              <input className="input" type="time" value={draft.break_end} onChange={(e) => setDraft((p) => ({ ...p, break_end: e.target.value }))} />
              <input className="input" type="number" min={5} max={180} value={draft.slot_interval_minutes} onChange={(e) => setDraft((p) => ({ ...p, slot_interval_minutes: e.target.value }))} required />
              <input className="input" type="number" min={1} max={100} value={draft.capacity_per_slot} onChange={(e) => setDraft((p) => ({ ...p, capacity_per_slot: e.target.value }))} required />

              <label className="text-sm flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
                เปิดใช้งาน
              </label>

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {deleteId ? (
        <>
          <button className="fixed inset-0 z-[60] bg-slate-900/30" onClick={() => setDeleteId(null)} aria-label="Close confirm" />
          <div className="fixed left-1/2 top-1/2 z-[61] w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">ลบเวลาทำการนี้?</p>
            <p className="mt-1 text-xs text-slate-500">ข้อมูลจะถูกซ่อนจากระบบทันที</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setDeleteId(null)}>ยกเลิก</button>
              <button className="btn-primary bg-rose-600 hover:bg-rose-700" onClick={() => void onDelete()}>ลบ</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
