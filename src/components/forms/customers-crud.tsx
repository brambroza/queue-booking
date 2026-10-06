'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { MobileCardList } from '@/components/ui/responsive-table';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { NICKNAME_MAX } from '@/lib/booking/customer-label';

type LineUser = { id: string; line_user_id: string; display_name: string | null; picture_url?: string | null };
type CustomerRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  phone: string;
  note: string | null;
  line_user_id: string | null;
  line_user: LineUser | null;
};

/**
 * Round avatar: the customer's LINE profile picture, or the first letter of their name when
 * they have no LINE link / no picture (or the image fails to load).
 */
function CustomerAvatar({ row, size = 36 }: { row: CustomerRow; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = row.line_user?.picture_url;
  const dimension = { width: size, height: size };
  if (url && !failed) {
    return (
      // LINE CDN images, plain <img> like the chat inbox (no next/image remotePatterns configured).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={row.line_user?.display_name ?? row.full_name}
        style={dimension}
        className="shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span style={dimension} className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600" aria-hidden>
      {(row.nickname || row.full_name || 'U').trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

type FormState = {
  id: string | null;
  full_name: string;
  nickname: string;
  phone: string;
  note: string;
  line_user_id: string;
};

const initialForm: FormState = {
  id: null,
  full_name: '',
  nickname: '',
  phone: '',
  note: '',
  line_user_id: '',
};

export function CustomersCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [lineUsers, setLineUsers] = useState<LineUser[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Real count from the API: the list is paged on the server, `rows` only holds the current page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const editing = Boolean(form.id);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Search is typed continuously; wait for a pause before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // A new search or page size always starts from page 1.
  useEffect(() => { setPage(1); }, [debouncedQ, rowsPerPage]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), page_size: String(rowsPerPage) });
        if (debouncedQ) params.set('q', debouncedQ);
        const res = await fetch(`/api/customers?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return push(json.error ?? 'โหลดลูกค้าไม่สำเร็จ', 'error');
        const count = Number(json.pagination?.total ?? 0);
        // Deleted the last row of the last page: step back instead of showing an empty page.
        if ((json.data ?? []).length === 0 && count > 0 && page > 1) return setPage(Math.max(1, Math.ceil(count / rowsPerPage)));
        setRows(json.data ?? []);
        setTotal(count);
      } catch (e) {
        if (controller.signal.aborted) return;
        push(e instanceof Error ? e.message : 'โหลดลูกค้าไม่สำเร็จ', 'error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page, rowsPerPage, debouncedQ, reloadKey, push]);

  // LINE users for the link dropdown in the form; independent of the list paging.
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/chat-inbox?page_size=100', { cache: 'no-store' }).catch(() => null);
      if (!res) return;
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return push(json.error ?? 'โหลด line users ไม่สำเร็จ', 'error');
      setLineUsers(json.data?.users ?? []);
    })();
  }, [push]);

  function openAdd() {
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setForm({
      id: row.id,
      full_name: row.full_name,
      nickname: row.nickname ?? '',
      phone: row.phone,
      note: row.note ?? '',
      line_user_id: row.line_user_id ?? '',
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2 || form.phone.trim().length < 8) {
      push('กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง', 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/customers', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        full_name: form.full_name,
        nickname: form.nickname.trim() || null,
        phone: form.phone,
        note: form.note || null,
        line_user_id: form.line_user_id || null,
      }),
    }).catch(() => null);
    if (!res) {
      setSaving(false);
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
      return;
    }
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push(editing ? 'อัปเดตข้อมูลลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว');
    setDrawerOpen(false);
    setForm(initialForm);
    reload();
  }

  async function onDelete(row: CustomerRow) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบลูกค้านี้?',
      description: 'ประวัติการจองยังอยู่ในรายงาน แต่ลูกค้าจะหายจากรายชื่อและค้นหาไม่พบ',
      context: {
        primary: row.nickname ? `${row.nickname} (${row.full_name})` : row.full_name,
        secondary: row.phone,
      },
      confirmLabel: 'ลบลูกค้า',
    });
    if (!ok) return;
    const res = await fetch(`/api/customers?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบลูกค้าแล้ว');
    reload();
  }

  /** Icon-only edit / delete (tooltip + aria-label); delete still asks through the confirm dialog. */
  const renderActions = (row: CustomerRow) => (
    <ActionIconGroup
      actions={[
        { key: 'edit', icon: <EditOutlinedIcon fontSize="small" />, labelKey: 'common.edit', fallbackLabel: 'Edit', onClick: () => openEdit(row) },
        { key: 'delete', icon: <DeleteOutlineIcon fontSize="small" />, labelKey: 'common.delete', fallbackLabel: 'Delete', color: 'error', onClick: () => void onDelete(row) },
      ]}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">รายการลูกค้า</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input className="input w-full sm:w-56" placeholder="ค้นหาชื่อ/ชื่อเล่น/เบอร์" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline inline-flex items-center gap-1.5" onClick={reload} disabled={loading}>
            <SearchRoundedIcon fontSize="small" />
            ค้นหา
          </button>
          <button className="btn-primary inline-flex items-center gap-1.5" onClick={openAdd}>
            <AddRoundedIcon fontSize="small" />
            เพิ่ม
          </button>
        </div>
      </div>

      <div className="card">
        {/* Phones: one card per customer. */}
        <MobileCardList
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', label: 'Name', card: 'title', render: (r) => (
              <span className="flex items-center gap-2">
                <CustomerAvatar row={r} size={32} />
                <span>{r.nickname ? `${r.full_name} (${r.nickname})` : r.full_name}</span>
              </span>
            ) },
            { key: 'phone', label: 'Phone', card: 'subtitle', render: (r) => r.phone },
            { key: 'line', label: 'LINE User', render: (r) => r.line_user?.display_name || r.line_user?.line_user_id || '-' },
            { key: 'note', label: 'Note', render: (r) => r.note || '-' },
          ]}
          actions={(r) => renderActions(r)}
          emptyState={<p className="px-3 py-4 text-sm text-slate-500">ยังไม่มีลูกค้า</p>}
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        />
        <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">ชื่อเล่น</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">LINE User</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>{loading ? 'กำลังโหลด…' : debouncedQ ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีลูกค้า'}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2.5">
                    <CustomerAvatar row={r} />
                    <span>{r.full_name}</span>
                  </span>
                </td>
                <td className="px-3 py-2">{r.nickname || <span className="text-slate-400">-</span>}</td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">{r.line_user?.display_name || r.line_user?.line_user_id || '-'}</td>
                <td className="px-3 py-2">{r.note || '-'}</td>
                <td className="px-3 py-2">{renderActions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {total > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={total}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">ชื่อลูกค้า</span>
                  <input className="input" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">เบอร์โทร</span>
                  <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
                </label>
              </div>

              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">ชื่อเล่น (ไม่บังคับ — ใช้เรียกคิว แสดงบนจอคิว)</span>
                <input className="input" value={form.nickname} maxLength={NICKNAME_MAX} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} />
              </label>

              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">ผูก LINE User (ไม่บังคับ)</span>
                <select className="input" value={form.line_user_id} onChange={(e) => setForm((p) => ({ ...p, line_user_id: e.target.value }))}>
                  <option value="">ไม่ผูก</option>
                  {lineUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name || u.line_user_id}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">หมายเหตุ</span>
                <textarea className="input min-h-24" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
              </label>

              <div className="flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : (editing ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า')}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
