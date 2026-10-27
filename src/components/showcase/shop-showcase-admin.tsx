'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BUSINESS_TYPE_LABELS, isBusinessType } from '@/lib/line/rich-menu/business-types';
import { hasUnreviewedEdit, type ShowcaseAdminAction, type ShowcaseEligibility, type ShowcaseRow } from '@/lib/showcase/showcase-rules';
import { ShowcaseStatusPill } from './showcase-status-pill';

type Item = {
  row: ShowcaseRow;
  shop: { id: string; name: string; shop_key: string | null; logo_url: string | null; business_type: string | null };
  published: boolean;
  real_bookings: number;
  line_connected: boolean;
  eligibility: ShowcaseEligibility;
};

/** Reason text the admin can pick from; editable before sending. */
const REJECT_PRESETS = ['คำรีวิวสั้นหรือไม่ชัดเจน', 'โลโก้ไม่ชัดหรือไม่เหมาะสม', 'ร้านยังไม่ได้ใช้งานจริง'];

/** Review queue for /portal/shop-showcase (super_admin). */
export function ShopShowcaseAdmin() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Item[] | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await fetch('/api/admin/shop-showcase');
      const json = (await res.json().catch(() => ({}))) as { data?: { items: Item[]; migrated: boolean } };
      if (!res.ok || !json.data) {
        setLoadError(true);
        return;
      }
      setItems(json.data.items);
      setMigrated(json.data.migrated);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(item: Item, action: ShowcaseAdminAction) {
    const reason = reasons[item.shop.id]?.trim() || null;
    if ((action === 'reject' || action === 'unpublish') && !reason) {
      push('ใส่เหตุผลก่อน ร้านจะได้รู้ว่าต้องแก้อะไร', 'error');
      return;
    }
    if (action === 'unpublish') {
      const ok = await confirm({
        tone: 'error',
        title: 'นำร้านนี้ออกจากหน้าแรก?',
        description: 'ร้านหายจากหน้าแรกทันที และได้รับแจ้งพร้อมเหตุผล ร้านต้องส่งตรวจใหม่ถึงจะกลับมาแสดง',
        context: { primary: item.shop.name, secondary: reason ?? undefined },
        confirmLabel: 'นำออกจากหน้าแรก',
      });
      if (!ok) return;
    }
    setBusyId(item.shop.id);
    try {
      const res = await fetch('/api/admin/shop-showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: item.shop.id, action, reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      push(
        action === 'approve' ? 'อนุมัติแล้ว ร้านขึ้นหน้าแรก' : action === 'reject' ? 'ไม่อนุมัติ แจ้งร้านแล้ว' : action === 'unpublish' ? 'นำออกจากหน้าแรกแล้ว' : 'บันทึกแล้ว'
      );
      setReasons((r) => ({ ...r, [item.shop.id]: '' }));
      await load();
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        โหลดรายการไม่สำเร็จ{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!items) return <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />;
  if (!migrated) {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">ยังไม่ได้รัน migration 202610270001_shop_showcase.sql</p>;
  }
  if (items.length === 0) {
    return <EmptyState title="ยังไม่มีร้านที่ยินยอม" description="ร้านที่ติ๊กยินยอมตอนสมัคร หรือเปิดในหน้าตั้งค่า จะขึ้นที่นี่" />;
  }

  const pendingCount = items.filter((i) => i.row.status === 'pending').length;
  const liveCount = items.filter((i) => i.published).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        รอตรวจ <b>{pendingCount}</b> ร้าน · แสดงอยู่บนหน้าแรก <b>{liveCount}</b> ร้าน
      </p>
      {items.map((item) => {
        const { row, shop } = item;
        const type = isBusinessType(shop.business_type) ? BUSINESS_TYPE_LABELS[shop.business_type] : 'ไม่ระบุประเภท';
        const busy = busyId === shop.id;
        const reviewing = row.status === 'pending';
        return (
          <article key={shop.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {shop.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.logo_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-200 font-semibold text-slate-600">{shop.name.charAt(0)}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{shop.name}</p>
                  <p className="text-xs text-slate-500">
                    {type}
                    {row.area_label ? ` · ${row.area_label}` : ''} · {shop.shop_key}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.featured && <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">ร้านแนะนำ</span>}
                <ShowcaseStatusPill status={row.consent ? row.status : 'revoked'} published={item.published} />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className={item.real_bookings < 20 ? 'text-rose-600' : 'text-slate-600'}>คิวจริง {item.real_bookings}</span>
              <span className={item.line_connected ? 'text-slate-600' : 'text-rose-600'}>LINE {item.line_connected ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}</span>
              <span className="text-slate-500">
                ยินยอม {row.consented_at ? new Date(row.consented_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'} (ฉบับ {row.consent_version ?? '-'})
              </span>
              {!item.eligibility.ok && <span className="text-amber-700">ควรดูก่อน: {item.eligibility.reasons.join(', ')}</span>}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-slate-500">{reviewing ? 'ข้อความที่ส่งมาตรวจ' : 'คำรีวิวปัจจุบัน'}</p>
                <p className="text-slate-800">{row.quote ? `“${row.quote}”` : <span className="text-slate-400">ไม่มีคำรีวิว (ขึ้นเฉพาะแถบโลโก้)</span>}</p>
              </div>
              {item.published && (reviewing || hasUnreviewedEdit(row)) && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-emerald-700">ที่แสดงบนเว็บตอนนี้</p>
                  <p className="text-slate-800">{row.published_quote ? `“${row.published_quote}”` : '-'}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              แสดง: {[row.show_logo && 'โลโก้', row.show_business_type && 'ประเภท', row.show_area && 'พื้นที่', row.show_booking_link && 'ปุ่มจอง'].filter(Boolean).join(', ') || 'ชื่อร้านอย่างเดียว'}
            </p>

            {(reviewing || item.published) && row.consent && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap gap-1">
                  {REJECT_PRESETS.map((p) => (
                    <button key={p} type="button" className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" onClick={() => setReasons((r) => ({ ...r, [shop.id]: p }))}>
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  id={`reason-${shop.id}`}
                  className="input"
                  maxLength={300}
                  placeholder="เหตุผล (ต้องใส่เมื่อไม่อนุมัติหรือนำออก) ร้านจะเห็นข้อความนี้"
                  value={reasons[shop.id] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [shop.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  {reviewing && (
                    <>
                      <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(item, 'approve')}>
                        อนุมัติ
                      </button>
                      <button type="button" className="btn-outline" disabled={busy} onClick={() => void act(item, 'reject')}>
                        ไม่อนุมัติ
                      </button>
                    </>
                  )}
                  {item.published && (
                    <>
                      <button type="button" className="btn-outline" disabled={busy} onClick={() => void act(item, row.featured ? 'unfeature' : 'feature')}>
                        {row.featured ? 'เลิกปักร้านแนะนำ' : 'ปักเป็นร้านแนะนำ'}
                      </button>
                      <button type="button" className="btn-outline text-rose-600" disabled={busy} onClick={() => void act(item, 'unpublish')}>
                        นำออกจากหน้าแรก
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
