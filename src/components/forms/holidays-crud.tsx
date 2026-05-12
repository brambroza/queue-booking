'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { formatDateDMY } from '@/lib/utils/date-format';

type Branch = { id: string; branch_name: string };
type Holiday = {
  id: string;
  branch_id?: string | null;
  holiday_date: string;
  reason?: string | null;
  branches?: { branch_name?: string } | null;
};

type Draft = {
  id?: string;
  branch_id: string;
  holiday_date: string;
  reason: string;
};

const EMPTY_DRAFT: Draft = {
  branch_id: '',
  holiday_date: '',
  reason: '',
};

export function HolidaysCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [holidayRes, brRes] = await Promise.all([fetch('/api/holidays', { cache: 'no-store' }), fetch('/api/branches', { cache: 'no-store' })]);
    const [holidayJson, brJson] = await Promise.all([holidayRes.json(), brRes.json()]);

    if (!holidayRes.ok) return push(holidayJson.error ?? 'โหลดวันหยุดไม่สำเร็จ', 'error');
    if (!brRes.ok) return push(brJson.error ?? 'โหลดสาขาไม่สำเร็จ', 'error');

    setRows((holidayJson.data ?? []) as Holiday[]);
    setBranches((brJson.data ?? []) as Branch[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setDrawerOpen(true);
  }

  function openEdit(row: Holiday) {
    setDraft({
      id: row.id,
      branch_id: row.branch_id ?? '',
      holiday_date: row.holiday_date,
      reason: row.reason ?? '',
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      branch_id: draft.branch_id || null,
      holiday_date: draft.holiday_date,
      reason: draft.reason || null,
    };

    const res = await fetch('/api/holidays', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.id ? { id: draft.id, ...payload } : payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');

    push(draft.id ? 'แก้ไขวันหยุดแล้ว' : 'เพิ่มวันหยุดแล้ว');
    setDrawerOpen(false);
    setDraft(EMPTY_DRAFT);
    void load();
  }

  async function onDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/holidays?id=${deleteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบวันหยุดแล้ว');
    setDeleteId(null);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">จัดการวันหยุด</h3>
        <button className="btn-primary" onClick={openCreate}>เพิ่มวันหยุด</button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูลวันหยุด</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">วันที่</th>
                <th className="px-2 py-2 text-left">สาขา</th>
                <th className="px-2 py-2 text-left">เหตุผล</th>
                <th className="px-2 py-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{formatDateDMY(r.holiday_date)}</td>
                  <td className="px-2 py-2">{r.branches?.branch_name ?? 'ทุกสาขา'}</td>
                  <td className="px-2 py-2">{r.reason || '-'}</td>
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
              <h4 className="text-lg font-semibold">{draft.id ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>ปิด</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <input className="input" type="date" value={draft.holiday_date} onChange={(e) => setDraft((p) => ({ ...p, holiday_date: e.target.value }))} required />
              <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))}>
                <option value="">ทุกสาขา</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <input className="input sm:col-span-2" value={draft.reason} onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))} placeholder="เหตุผล (เช่น วันนักขัตฤกษ์)" />

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
            <p className="text-sm font-semibold text-slate-800">ลบวันหยุดนี้?</p>
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
