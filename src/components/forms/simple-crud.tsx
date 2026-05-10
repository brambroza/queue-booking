'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ActionIconGroup } from '@/components/ui/action-icon-group';

type Column = { key: string; label: string; type?: 'text' | 'number' | 'time' | 'date' | 'checkbox' };

export function SimpleCrud({
  endpoint,
  title,
  columns,
  defaults,
}: {
  endpoint: string;
  title: string;
  columns: Column[];
  defaults: Record<string, string | number | boolean>;
}) {
  const { push } = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(endpoint, { cache: 'no-store' });
    const json = await res.json();
    setRows(json.data ?? []);
    setPage(1);
    setLoading(false);
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = { ...defaults } as Record<string, unknown>;

    columns.forEach((c) => {
      if (c.type === 'checkbox') payload[c.key] = formData.get(c.key) === 'on';
      else payload[c.key] = formData.get(c.key);
    });

    setSaving(true);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push('บันทึกสำเร็จ');
    form.reset();
    setDrawerOpen(false);
    void load();
  }

  async function onDelete(id: string) {
    if (!window.confirm('ยืนยันการลบรายการนี้?')) return;
    const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      push('ลบไม่สำเร็จ', 'error');
      return;
    }
    push('ลบสำเร็จ');
    void load();
  }

  const pagedRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">รายการ{title}</h3>
        <button className="btn-primary" onClick={() => setDrawerOpen(true)}>Add New</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <p className="p-4 text-sm">กำลังโหลด...</p> : null}
        {!loading && rows.length === 0 ? <p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูล</p> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.label}</th>)}
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={String(row.id)} className="border-t border-slate-100">
                    {columns.map((c) => <td key={c.key} className="px-3 py-2">{String(row[c.key] ?? '-')}</td>)}
                    <td className="px-3 py-2">
                      <ActionIconGroup
                        actions={[
                          {
                            key: 'delete',
                            icon: <DeleteOutlineIcon fontSize="small" />,
                            labelKey: 'common.delete',
                            fallbackLabel: 'Delete',
                            color: 'error',
                            onClick: () => void onDelete(String(row.id)),
                            confirmBeforeClick: true,
                            confirmTitle: 'Delete',
                            confirmMessage: 'ยืนยันการลบรายการนี้?',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
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
          <aside className="fixed right-0 top-0 z-50 h-screen w-full bg-white p-5 shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">เพิ่ม{title}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              {columns.map((c) => (
                <label key={c.key} className="text-sm">
                  <span className="mb-1 block text-slate-600">{c.label}</span>
                  {c.type === 'checkbox' ? (
                    <input type="checkbox" name={c.key} defaultChecked={Boolean(defaults[c.key])} />
                  ) : (
                    <input className="input" name={c.key} type={c.type ?? 'text'} defaultValue={String(defaults[c.key] ?? '')} required />
                  )}
                </label>
              ))}
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : `เพิ่ม ${title}`}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
