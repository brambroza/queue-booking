'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type ShopProfile = {
  id: string;
  name: string;
  shop_key: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
};

type ShopSubscription = {
  plan_code?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
  subscription_plans?: { code?: string | null; name?: string | null } | null;
};

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
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopLogoFile, setShopLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const editing = Boolean(form.id);
  const pagedRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/settings?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลด settings ไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }

  async function loadShop() {
    const [shopRes, subRes] = await Promise.all([
      fetch('/api/shop-profile', { cache: 'no-store' }),
      fetch('/api/shop-subscription/current', { cache: 'no-store' }),
    ]);
    const [shopJson, subJson] = await Promise.all([shopRes.json(), subRes.json()]);
    if (!shopRes.ok) return push(shopJson.error ?? 'โหลดโปรไฟล์ร้านไม่สำเร็จ', 'error');
    if (!subRes.ok) return push(subJson.error ?? 'โหลดแพ็กเกจร้านไม่สำเร็จ', 'error');
    setShop(shopJson.data ?? null);
    setSubscription((subJson.data ?? null) as ShopSubscription | null);
  }

  useEffect(() => {
    void load();
    void loadShop();
  }, []);

  async function saveShopProfile() {
    if (!shop) return;
    if (!shop.name.trim()) return push('กรุณาระบุชื่อร้าน', 'error');

    setShopSaving(true);
    const form = new FormData();
    form.set('name', shop.name.trim());
    form.set('phone', shop.phone?.trim() ?? '');
    form.set('email', shop.email?.trim() ?? '');
    form.set('address', shop.address?.trim() ?? '');
    form.set('remove_logo', removeLogo ? 'true' : 'false');
    if (shopLogoFile) form.set('logo', shopLogoFile);

    const res = await fetch('/api/shop-profile', { method: 'PATCH', body: form });
    const json = await res.json();
    setShopSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกโปรไฟล์ร้านไม่สำเร็จ', 'error');
    push('บันทึกโปรไฟล์ร้านแล้ว');
    setShopLogoFile(null);
    setRemoveLogo(false);
    void loadShop();
  }

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
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Shop Profile</h3>
            <p className="text-sm text-slate-500">จัดการข้อมูลร้านค้าและโลโก้</p>
          </div>
          <button className="btn-primary" onClick={() => void saveShopProfile()} disabled={!shop || shopSaving}>
            {shopSaving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
          </button>
        </div>

        {!shop ? (
          <p className="text-sm text-slate-500">กำลังโหลดข้อมูลร้าน...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 md:col-span-2">
              <p className="font-semibold">แพ็กเกจปัจจุบัน: {subscription?.subscription_plans?.name ?? subscription?.plan_code ?? 'ยังไม่กำหนด'}</p>
              <p className="mt-1 text-emerald-800">
                วันหมดอายุ: {subscription?.expires_at ? subscription.expires_at.slice(0, 10) : 'ไม่กำหนด'} • สถานะ: {subscription?.is_active === false ? 'ระงับ' : 'ใช้งาน'}
              </p>
            </div>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ชื่อร้าน</span>
              <input className="input" value={shop.name} onChange={(e) => setShop((p) => (p ? { ...p, name: e.target.value } : p))} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Shop Key</span>
              <input className="input bg-slate-50" value={shop.shop_key} readOnly />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">เบอร์โทร</span>
              <input className="input" value={shop.phone ?? ''} onChange={(e) => setShop((p) => (p ? { ...p, phone: e.target.value } : p))} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">อีเมล</span>
              <input className="input" type="email" value={shop.email ?? ''} onChange={(e) => setShop((p) => (p ? { ...p, email: e.target.value } : p))} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">ที่อยู่</span>
              <textarea className="input min-h-20" value={shop.address ?? ''} onChange={(e) => setShop((p) => (p ? { ...p, address: e.target.value } : p))} />
            </label>

            <div className="md:col-span-2">
              <span className="mb-2 block text-sm text-slate-600">โลโก้ร้าน</span>
              <div className="flex flex-wrap items-center gap-3">
                {shop.logo_url && !removeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.logo_url} alt="Shop logo" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">No Logo</div>
                )}
                <input
                  className="input max-w-sm"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => setShopLogoFile(e.target.files?.[0] ?? null)}
                />
                {shop.logo_url ? (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} />
                    ลบโลโก้ปัจจุบัน
                  </label>
                ) : null}
              </div>
              {shopLogoFile ? <p className="mt-2 text-xs text-slate-500">ไฟล์ใหม่: {shopLogoFile.name}</p> : null}
            </div>
          </div>
        )}
      </div>

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
            ) : pagedRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 font-medium">{r.key}</td>
                <td className="px-3 py-2"><pre className="whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(r.value, null, 2)}</pre></td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTimeDMY(r.updated_at)}</td>
                <td className="px-3 py-2 flex gap-2">
                  <button className="btn-outline" onClick={() => openEdit(r)}>Edit</button>
                  <button className="btn-outline" onClick={() => void onDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
