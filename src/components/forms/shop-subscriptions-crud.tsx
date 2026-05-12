'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';

type Plan = { id: string; code: string; name: string };
type Shop = { id: string; name: string; shop_key: string; companies?: { name?: string } | null };
type Sub = {
  shop_id: string;
  plan_id?: string | null;
  plan_code?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  max_branches_override?: number | null;
  max_services_override?: number | null;
  max_staff_override?: number | null;
  max_resources_override?: number | null;
  max_monthly_bookings_override?: number | null;
  note?: string | null;
  subscription_plans?: { name?: string; code?: string } | null;
};

export function ShopSubscriptionsCrud() {
  const { push } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({
    shop_id: '',
    plan_id: '',
    expires_at: '',
    is_active: true,
    max_branches_override: '',
    max_services_override: '',
    max_staff_override: '',
    max_resources_override: '',
    max_monthly_bookings_override: '',
    note: '',
  });

  const subMap = useMemo(() => new Map(subs.map((s) => [s.shop_id, s])), [subs]);
  const rows = useMemo(() => shops.map((shop) => ({ shop, sub: subMap.get(shop.id) })), [shops, subMap]);
  const paged = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const res = await fetch('/api/admin/shop-subscriptions', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดข้อมูลแพ็กเกจไม่สำเร็จ', 'error');
    setPlans(json.data?.plans ?? []);
    setShops(json.data?.shops ?? []);
    setSubs(json.data?.subscriptions ?? []);
  }

  useEffect(() => { void load(); }, []);

  function openEdit(shop: Shop) {
    const sub = subMap.get(shop.id);
    setDraft({
      shop_id: shop.id,
      plan_id: sub?.plan_id ?? '',
      expires_at: sub?.expires_at ? String(sub.expires_at).slice(0, 10) : '',
      is_active: sub?.is_active ?? true,
      max_branches_override: sub?.max_branches_override != null ? String(sub.max_branches_override) : '',
      max_services_override: sub?.max_services_override != null ? String(sub.max_services_override) : '',
      max_staff_override: sub?.max_staff_override != null ? String(sub.max_staff_override) : '',
      max_resources_override: sub?.max_resources_override != null ? String(sub.max_resources_override) : '',
      max_monthly_bookings_override: sub?.max_monthly_bookings_override != null ? String(sub.max_monthly_bookings_override) : '',
      note: sub?.note ?? '',
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.shop_id) return;
    setSaving(true);
    const payload = {
      shop_id: String(draft.shop_id),
      plan_id: draft.plan_id ? String(draft.plan_id) : null,
      expires_at: draft.expires_at ? `${String(draft.expires_at)}T23:59:59+07:00` : null,
      is_active: Boolean(draft.is_active),
      max_branches_override: draft.max_branches_override ? Number(draft.max_branches_override) : null,
      max_services_override: draft.max_services_override ? Number(draft.max_services_override) : null,
      max_staff_override: draft.max_staff_override ? Number(draft.max_staff_override) : null,
      max_resources_override: draft.max_resources_override ? Number(draft.max_resources_override) : null,
      max_monthly_bookings_override: draft.max_monthly_bookings_override ? Number(draft.max_monthly_bookings_override) : null,
      note: draft.note ? String(draft.note) : null,
    };

    const res = await fetch('/api/admin/shop-subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกแพ็กเกจไม่สำเร็จ', 'error');

    push('บันทึกแพ็กเกจแล้ว');
    setDrawerOpen(false);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-700">Super Admin: จัดการสิทธิ์ร้านค้า, จำนวนสาขา, และวันหมดอายุแพ็กเกจ</div>

      <div className="card p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left">ร้านค้า</th>
              <th className="px-2 py-2 text-left">บริษัท</th>
              <th className="px-2 py-2 text-left">แพ็กเกจ</th>
              <th className="px-2 py-2 text-left">หมดอายุ</th>
              <th className="px-2 py-2 text-left">สถานะ</th>
              <th className="px-2 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(({ shop, sub }) => (
              <tr key={shop.id} className="border-t border-slate-100">
                <td className="px-2 py-2">
                  <div className="font-medium">{shop.name}</div>
                  <div className="text-xs text-slate-500">{shop.shop_key}</div>
                </td>
                <td className="px-2 py-2">{shop.companies?.name ?? '-'}</td>
                <td className="px-2 py-2">{sub?.subscription_plans?.name ?? sub?.plan_code ?? 'ยังไม่กำหนด'}</td>
                <td className="px-2 py-2">{sub?.expires_at ? String(sub.expires_at).slice(0, 10) : '-'}</td>
                <td className="px-2 py-2">{sub?.is_active === false ? 'ระงับ' : 'ใช้งาน'}</td>
                <td className="px-2 py-2 text-right">
                  <ActionIconGroup actions={[{ key: 'edit', icon: <EditOutlinedIcon fontSize="small" />, labelKey: 'common.edit', fallbackLabel: 'Edit', onClick: () => openEdit(shop) }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePaginationControls
          page={page}
          rowsPerPage={rowsPerPage}
          total={rows.length}
          onPageChange={setPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
        />
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="close" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full overflow-y-auto bg-white p-5 shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">กำหนดแพ็กเกจร้านค้า</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>ปิด</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <select className="input" value={String(draft.plan_id ?? '')} onChange={(e) => setDraft((p) => ({ ...p, plan_id: e.target.value }))}>
                <option value="">ไม่ผูก plan (ไม่จำกัด)</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
              <input className="input" type="date" value={String(draft.expires_at ?? '')} onChange={(e) => setDraft((p) => ({ ...p, expires_at: e.target.value }))} />

              <input className="input" type="number" min={1} placeholder="Override max branches" value={String(draft.max_branches_override ?? '')} onChange={(e) => setDraft((p) => ({ ...p, max_branches_override: e.target.value }))} />
              <input className="input" type="number" min={1} placeholder="Override max services" value={String(draft.max_services_override ?? '')} onChange={(e) => setDraft((p) => ({ ...p, max_services_override: e.target.value }))} />
              <input className="input" type="number" min={1} placeholder="Override max staff" value={String(draft.max_staff_override ?? '')} onChange={(e) => setDraft((p) => ({ ...p, max_staff_override: e.target.value }))} />
              <input className="input" type="number" min={1} placeholder="Override max resources" value={String(draft.max_resources_override ?? '')} onChange={(e) => setDraft((p) => ({ ...p, max_resources_override: e.target.value }))} />
              <input className="input sm:col-span-2" type="number" min={1} placeholder="Override max monthly bookings" value={String(draft.max_monthly_bookings_override ?? '')} onChange={(e) => setDraft((p) => ({ ...p, max_monthly_bookings_override: e.target.value }))} />
              <input className="input sm:col-span-2" placeholder="หมายเหตุ" value={String(draft.note ?? '')} onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))} />

              <label className="text-sm flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={Boolean(draft.is_active)} onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))} />
                เปิดใช้งาน subscription
              </label>

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
