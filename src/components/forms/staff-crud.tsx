'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type RefUser = { id: string; full_name: string | null; email: string | null; phone: string | null };
type RefBranch = { id: string; branch_name: string };
type StaffRow = { id: string; user_id: string; display_name: string; active: boolean; branches: Array<{ id: string; branch_name: string }> };

type FormState = {
  id: string | null;
  user_id: string;
  display_name: string;
  active: boolean;
  branch_ids: string[];
};

const initialForm: FormState = {
  id: null,
  user_id: '',
  display_name: '',
  active: true,
  branch_ids: [],
};

export function StaffCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [users, setUsers] = useState<RefUser[]>([]);
  const [branches, setBranches] = useState<RefBranch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);

  const editing = Boolean(form.id);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลด staff ไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
    setUsers(json.refs?.users ?? []);
    setBranches(json.refs?.branches ?? []);
  }

  useEffect(() => { void load(); }, []);

  const selectedUser = useMemo(() => users.find((u) => u.id === form.user_id), [users, form.user_id]);

  function openAdd() {
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function openEdit(row: StaffRow) {
    setForm({
      id: row.id,
      user_id: row.user_id,
      display_name: row.display_name,
      active: row.active,
      branch_ids: row.branches.map((b) => b.id),
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.user_id || !form.display_name.trim()) {
      push('กรุณาเลือกผู้ใช้และชื่อแสดงผล', 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/staff', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        user_id: form.user_id,
        display_name: form.display_name,
        active: form.active,
        branch_ids: form.branch_ids,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push(editing ? 'อัปเดตพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว');
    setDrawerOpen(false);
    setForm(initialForm);
    void load();
  }

  async function onDelete(id: string) {
    if (!window.confirm('ยืนยันลบพนักงานนี้?')) return;
    const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบพนักงานแล้ว');
    void load();
  }

  function toggleBranch(branchId: string) {
    setForm((prev) => ({
      ...prev,
      branch_ids: prev.branch_ids.includes(branchId)
        ? prev.branch_ids.filter((x) => x !== branchId)
        : [...prev.branch_ids, branchId],
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">รายการพนักงาน</h3>
        <div className="flex items-center gap-2">
          <input className="input w-56" placeholder="ค้นหาชื่อพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline" onClick={() => void load()}>Search</button>
          <button className="btn-primary" onClick={openAdd}>Add New</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Display Name</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Branches</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={5}>ยังไม่มีพนักงาน</td></tr>
            ) : rows.map((r) => {
              const user = users.find((u) => u.id === r.user_id);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.display_name}</td>
                  <td className="px-3 py-2">{user?.email ?? user?.full_name ?? r.user_id}</td>
                  <td className="px-3 py-2">{r.branches.map((b) => b.branch_name).join(', ') || '-'}</td>
                  <td className="px-3 py-2">{r.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="btn-outline" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-outline" onClick={() => void onDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full overflow-y-auto bg-white p-5 shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">User Account</span>
                  <select
                    className="input"
                    value={form.user_id}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const u = users.find((x) => x.id === uid);
                      setForm((prev) => ({
                        ...prev,
                        user_id: uid,
                        display_name: prev.display_name || u?.full_name || u?.email || '',
                      }));
                    }}
                    required
                  >
                    <option value="">เลือก user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Display Name</span>
                  <input
                    className="input"
                    value={form.display_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">Assign Branches</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.branch_ids.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                      {b.branch_name}
                    </label>
                  ))}
                  {branches.length === 0 ? <p className="text-xs text-slate-500">ยังไม่มีสาขา</p> : null}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
                Active
              </label>

              <div className="flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : (editing ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน')}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>

              {selectedUser ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p>User: {selectedUser.full_name || '-'}</p>
                  <p>Email: {selectedUser.email || '-'}</p>
                  <p>Phone: {selectedUser.phone || '-'}</p>
                </div>
              ) : null}
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
