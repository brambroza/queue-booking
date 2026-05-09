'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type LineUser = { id: string; line_user_id: string; display_name: string | null };
type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  note: string | null;
  line_user_id: string | null;
  line_user: LineUser | null;
};

type FormState = {
  id: string | null;
  full_name: string;
  phone: string;
  note: string;
  line_user_id: string;
};

const initialForm: FormState = {
  id: null,
  full_name: '',
  phone: '',
  note: '',
  line_user_id: '',
};

export function CustomersCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [lineUsers, setLineUsers] = useState<LineUser[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);

  const editing = Boolean(form.id);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const [customersRes, lineUsersRes] = await Promise.all([
      fetch(`/api/customers?${params.toString()}`, { cache: 'no-store' }),
      fetch('/api/chat-inbox', { cache: 'no-store' }),
    ]);

    const [customersJson, lineUsersJson] = await Promise.all([customersRes.json(), lineUsersRes.json()]);

    if (!customersRes.ok) return push(customersJson.error ?? 'โหลดลูกค้าไม่สำเร็จ', 'error');
    if (!lineUsersRes.ok) return push(lineUsersJson.error ?? 'โหลด line users ไม่สำเร็จ', 'error');

    setRows(customersJson.data ?? []);
    setLineUsers(lineUsersJson.data?.users ?? []);
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setForm({
      id: row.id,
      full_name: row.full_name,
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
        phone: form.phone,
        note: form.note || null,
        line_user_id: form.line_user_id || null,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push(editing ? 'อัปเดตข้อมูลลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว');
    setDrawerOpen(false);
    setForm(initialForm);
    void load();
  }

  async function onDelete(id: string) {
    if (!window.confirm('ยืนยันลบลูกค้านี้?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบลูกค้าแล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">รายการลูกค้า</h3>
        <div className="flex items-center gap-2">
          <input className="input w-56" placeholder="ค้นหาชื่อ/เบอร์" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline" onClick={() => void load()}>Search</button>
          <button className="btn-primary" onClick={openAdd}>Add New</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">LINE User</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={5}>ยังไม่มีลูกค้า</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">{r.line_user?.display_name || r.line_user?.line_user_id || '-'}</td>
                <td className="px-3 py-2">{r.note || '-'}</td>
                <td className="px-3 py-2 flex gap-2">
                  <button className="btn-outline" onClick={() => openEdit(r)}>Edit</button>
                  <button className="btn-outline" onClick={() => void onDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full overflow-y-auto bg-white p-5 shadow-2xl sm:w-[60%]">
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
