'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BUSINESS_TYPE_LABELS, isBusinessType } from '@/lib/line/rich-menu/business-types';
import { SHOWCASE_AREA_MAX, SHOWCASE_QUOTE_MAX, hasUnreviewedEdit, type ShowcaseOwnerPatch, type ShowcaseRow } from '@/lib/showcase/showcase-rules';
import { ShowcaseStatusPill } from './showcase-status-pill';

type ShopInfo = { name: string; logo_url: string | null; business_type: string | null };
type Summary = { row: ShowcaseRow | null; published: boolean; shop: ShopInfo | null; migrated: boolean };
type Draft = Pick<ShowcaseRow, 'show_logo' | 'show_business_type' | 'show_area' | 'show_booking_link' | 'area_label' | 'quote'>;

const FLAG_LABELS: Array<[keyof Pick<Draft, 'show_logo' | 'show_business_type' | 'show_area' | 'show_booking_link'>, string]> = [
  ['show_logo', 'โลโก้ร้าน'],
  ['show_business_type', 'ประเภทธุรกิจ'],
  ['show_area', 'พื้นที่ / จังหวัด'],
  ['show_booking_link', 'ปุ่ม "จองคิวร้านนี้"'],
];

/** Fields the owner edits locally before saving. */
function toDraft(row: ShowcaseRow): Draft {
  return {
    show_logo: row.show_logo,
    show_business_type: row.show_business_type,
    show_area: row.show_area,
    show_booking_link: row.show_booking_link,
    area_label: row.area_label,
    quote: row.quote,
  };
}

/** Same card the landing page draws, so the owner sees exactly what goes public. */
function PreviewCard({ shop, draft }: { shop: ShopInfo; draft: Draft }) {
  const type = draft.show_business_type && isBusinessType(shop.business_type) ? BUSINESS_TYPE_LABELS[shop.business_type] : null;
  const meta = [type, draft.show_area ? draft.area_label : null].filter(Boolean).join(' · ');
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        {draft.show_logo && shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-base font-semibold text-white">{shop.name.charAt(0)}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{shop.name}</p>
          {meta && <p className="text-xs text-slate-500">{meta}</p>}
        </div>
      </div>
      {draft.quote?.trim() && <p className="text-sm text-slate-700">“{draft.quote.trim()}”</p>}
      {draft.show_booking_link && <p className="text-xs font-semibold text-emerald-700">จองคิวร้านนี้ ›</p>}
    </div>
  );
}

/**
 * "แสดงร้านบนเว็บ GoAlong" section of /portal/settings: PDPA consent, which
 * fields go public, the shop's quote, and the review state.
 */
export function ShowcaseSettingsCard() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/shop-showcase');
      const json = (await res.json().catch(() => ({}))) as { data?: Summary };
      if (!res.ok || !json.data) {
        setLoadError(true);
        return;
      }
      setSummary(json.data);
      setDraft(json.data.row ? toDraft(json.data.row) : null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /** Send a patch; returns true on success. */
  async function send(patch: ShowcaseOwnerPatch, success: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch('/api/shop-showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        push(res.status === 403 ? 'เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนการตั้งค่านี้ได้' : json.error ?? 'บันทึกไม่สำเร็จ', 'error');
        return false;
      }
      push(success);
      await load();
      return true;
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleConsent(on: boolean) {
    if (on) {
      await send({ consent: true }, 'บันทึกความยินยอมแล้ว');
      return;
    }
    const ok = await confirm({
      tone: 'warning',
      title: 'ถอนความยินยอมแสดงร้าน?',
      description: summary?.published
        ? 'ร้านจะหายจากหน้าแรกของ GoAlong Queue ภายในประมาณ 1 นาที เปิดใหม่ได้ภายหลังแต่ต้องรอตรวจอีกครั้ง'
        : 'ระบบจะหยุดใช้ข้อมูลร้านเพื่อแสดงบนเว็บ เปิดใหม่ได้ภายหลัง',
      context: summary?.shop ? { primary: summary.shop.name } : undefined,
      confirmLabel: 'ถอนความยินยอม',
      cancelLabel: 'ไม่ถอน',
    });
    if (ok) await send({ consent: false }, 'ถอนความยินยอมแล้ว');
  }

  if (loadError) {
    return (
      <section id="showcase" className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        โหลดการตั้งค่าการแสดงร้านไม่สำเร็จ{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          ลองใหม่
        </button>
      </section>
    );
  }
  if (!summary) {
    return <section id="showcase" className="h-40 max-w-2xl animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />;
  }

  const row = summary.row;
  const consent = Boolean(row?.consent);
  const dirty = Boolean(row && draft && JSON.stringify(toDraft(row)) !== JSON.stringify(draft));
  const pendingEdit = row ? hasUnreviewedEdit(row) : false;
  const canSubmit = consent && !dirty && row && (row.status === 'draft' || row.status === 'rejected' || pendingEdit);

  return (
    <section id="showcase" className="max-w-2xl scroll-mt-20 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-800">แสดงร้านบนเว็บ GoAlong Queue</h3>
        <p className="mt-1 text-xs text-slate-500">
          ร้านที่ยินยอมจะได้ขึ้นหน้าแรกของเรา พร้อมปุ่มให้ลูกค้าใหม่จองคิวผ่าน LINE ของร้าน ทีมงานตรวจก่อนแสดงทุกครั้ง ไม่บังคับ และถอนได้ทุกเมื่อ
        </p>
      </div>

      {!summary.migrated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">ฟีเจอร์นี้ยังไม่พร้อมใช้งานบนระบบ กรุณาแจ้งผู้ดูแลระบบ</p>
      )}

      {summary.migrated && row && draft && summary.shop && (
        <>
          <label className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <span>
              ยินยอมให้แสดงชื่อร้าน โลโก้ และคำรีวิวของร้านบนเว็บไซต์ GoAlong Queue
              <span className="mt-0.5 block text-xs text-slate-500">ข้อความยินยอมฉบับ {row.consent_version ?? 'ปัจจุบัน'} · ดู <a className="underline" href="/privacy-policy">นโยบายความเป็นส่วนตัว</a></span>
            </span>
            <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} disabled={busy} onChange={(e) => void toggleConsent(e.target.checked)} />
          </label>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">สถานะ:</span>
            <ShowcaseStatusPill status={consent ? row.status : row.status === 'revoked' ? 'revoked' : 'none'} published={summary.published} />
            {pendingEdit && <span className="text-xs text-amber-700">แก้คำรีวิวแล้วยังไม่ได้ส่งตรวจ หน้าแรกยังแสดงข้อความเดิม</span>}
          </div>
          {row.reject_reason && consent && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">ทีมงานแจ้ง: {row.reject_reason}</p>
          )}

          <fieldset disabled={!consent || busy} className={`space-y-4 ${consent ? '' : 'opacity-50'}`}>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">ข้อมูลที่ให้แสดง</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FLAG_LABELS.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={draft[key]} onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.checked } : d))} />
                    {label}
                  </label>
                ))}
              </div>
              {draft.show_logo && !summary.shop.logo_url && <p className="mt-1 text-xs text-slate-500">ร้านยังไม่มีโลโก้ อัปโหลดได้ในส่วนโปรไฟล์ร้านด้านบน</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="showcase_area" className="text-xs font-medium text-slate-600">พื้นที่ / จังหวัด (ไม่บังคับ)</label>
              <input
                id="showcase_area"
                className="input"
                maxLength={SHOWCASE_AREA_MAX}
                placeholder="เช่น นนทบุรี, สยาม"
                value={draft.area_label ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, area_label: e.target.value } : d))}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="showcase_quote" className="text-xs font-medium text-slate-600">คำรีวิวจากร้าน (ไม่บังคับ)</label>
              <textarea
                id="showcase_quote"
                className="input min-h-[80px]"
                maxLength={SHOWCASE_QUOTE_MAX}
                placeholder="ใช้ระบบแล้วร้านเปลี่ยนไปอย่างไร เช่น ลูกค้าจองผ่าน LINE ได้เอง ไม่ต้องรับโทรศัพท์ทั้งวัน"
                value={draft.quote ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, quote: e.target.value } : d))}
              />
              <p className="text-right text-xs text-slate-400">{(draft.quote ?? '').length}/{SHOWCASE_QUOTE_MAX}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">ตัวอย่างบนหน้าแรก</p>
              <PreviewCard shop={summary.shop} draft={draft} />
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline" disabled={!consent || !dirty || busy} onClick={() => void send(draft, 'บันทึกแล้ว')}>
              บันทึก
            </button>
            <button type="button" className="btn-primary" disabled={!canSubmit || busy} onClick={() => void send({ submit: true }, 'ส่งให้ทีมงานตรวจแล้ว')}>
              ส่งให้ตรวจ
            </button>
            {dirty && <span className="text-xs text-slate-500">บันทึกก่อนส่งให้ตรวจ</span>}
            {!dirty && row.status === 'pending' && <span className="text-xs text-slate-500">รอทีมงานตรวจ ปกติภายใน 1–2 วันทำการ</span>}
          </div>
        </>
      )}
    </section>
  );
}
