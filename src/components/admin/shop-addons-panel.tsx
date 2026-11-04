'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

/**
 * super_admin drawer section on /portal/shop-subscriptions: switch paid
 * add-ons (sold outside the plans) on or off for this shop through
 * `/api/admin/shop-addons`. Today: "จอคิวจาก Google Sheet".
 */

type AddonRow = { addon_key: string; active: boolean; expires_on: string | null; note: string | null; updated_at: string | null };

const SHEET_KEY = 'sheet_signage';

export function ShopAddonsPanel({ shopId, shopName }: { shopId: string; shopName: string }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [migrated, setMigrated] = useState(true);
  const [row, setRow] = useState<AddonRow | null>(null);
  const [active, setActive] = useState(false);
  const [expiresOn, setExpiresOn] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/shop-addons?shop_id=${encodeURIComponent(shopId)}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { data?: { migrated: boolean; addons: AddonRow[] }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? 'โหลดแพ็กเกจเสริมไม่สำเร็จ');
      const sheet = json.data.addons.find((a) => a.addon_key === SHEET_KEY) ?? null;
      setMigrated(json.data.migrated);
      setRow(sheet);
      setActive(Boolean(sheet?.active));
      setExpiresOn(sheet?.expires_on ?? '');
      setNote(sheet?.note ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { void load(); }, [load]);

  const dirty = active !== Boolean(row?.active) || expiresOn !== (row?.expires_on ?? '') || note !== (row?.note ?? '');

  async function save() {
    if (!active && row?.active) {
      const ok = await confirm({
        tone: 'warning',
        title: 'ปิดแพ็กเกจเสริมจอคิวจาก Google Sheet?',
        description: 'จอ TV ของร้านจะกลับไปแสดงคิวจากระบบจองในรอบรีเฟรชถัดไป',
        context: { primary: shopName },
        confirmLabel: 'ปิดแพ็กเกจเสริม',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shop-addons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, addon_key: SHEET_KEY, active, expires_on: expiresOn || null, note: note.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ');
      push('บันทึกแพ็กเกจเสริมแล้ว', 'success');
      await load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-soft)' }}>
      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--muted)' }}>แพ็กเกจเสริม (ขายแยกจากแผน)</p>
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>กำลังโหลด…</p>
      ) : error ? (
        <p className="text-xs" style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>
      ) : !migrated ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>ยังไม่ได้รัน migration 202611040001_signage_sheet_addon.sql</p>
      ) : (
        <>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input id="addon-sheet-signage" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            จอคิวจาก Google Sheet
          </label>
          <div className="mb-2 flex flex-wrap gap-3">
            <label className="text-xs" style={{ color: 'var(--muted)' }}>
              ใช้ได้ถึง (ว่าง = ไม่มีวันหมด)
              <input id="addon-sheet-expires" type="date" className="input mt-1 block" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </label>
            <label className="min-w-[220px] flex-1 text-xs" style={{ color: 'var(--muted)' }}>
              หมายเหตุ (เลขใบเสนอราคา / แพ็กเกจ)
              <input id="addon-sheet-note" className="input mt-1 block w-full" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกแพ็กเกจเสริม'}
          </button>
        </>
      )}
    </div>
  );
}
