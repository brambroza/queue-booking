'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type SettingRow = {
  id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id: string | null;
  key: string;
  valueText: string;
};

const initialForm: FormState = {
  id: null,
  key: '',
  valueText: '{\n  "enabled": true\n}',
};

export function SettingsCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);

  const editing = Boolean(form.id);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/settings?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลด settings ไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function openEdit(row: SettingRow) {
    setForm({
      id: row.id,
      key: row.key,
      valueText: JSON.stringify(row.value, null, 2),
    });
    setDrawerOpen(true);
  }

  function parseValue(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('JSON value ไม่ถูกต้อง');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.key.trim().length < 2) {
      push('กรุณาระบุ key อย่างน้อย 2 ตัวอักษร', 'error');
      return;
    }

    let parsedValue: unknown;
    try {
      parsedValue = parseValue(form.valueText);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Invalid JSON', 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/settings', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        key: form.key.trim(),
        value: parsedValue,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push(editing ? 'อัปเดต settings แล้ว' : 'เพิ่ม settings แล้ว');
    setDrawerOpen(false);
    setForm(initialForm);
    void load();
  }

  async function onDelete(id: string) {
    if (!window.confirm('ยืนยันลบ setting นี้?')) return;
    const res = await fetch(`/api/settings?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบ setting แล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Settings</h3>
        <div className="flex items-center gap-2">
          <input className="input w-56" placeholder="ค้นหา key" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline" onClick={() => void load()}>Search</button>
          <button className="btn-primary" onClick={openAdd}>Add New</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">Value (JSON)</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={4}>ยังไม่มี settings</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 font-medium">{r.key}</td>
                <td className="px-3 py-2"><pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(r.value, null, 2)}</pre></td>
                <td className="px-3 py-2 text-xs text-slate-600">{new Date(r.updated_at).toLocaleString()}</td>
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
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไข Setting' : 'เพิ่ม Setting'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">Key</span>
                <input className="input" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} required />
              </label>

              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">Value (JSON)</span>
                <textarea className="input min-h-56 font-mono text-xs" value={form.valueText} onChange={(e) => setForm((p) => ({ ...p, valueText: e.target.value }))} required />
              </label>

              <div className="flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : (editing ? 'บันทึกการแก้ไข' : 'เพิ่ม Setting')}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
