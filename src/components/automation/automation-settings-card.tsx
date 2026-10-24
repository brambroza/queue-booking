'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { FOLLOWUP_DELAY_PRESETS } from '@/lib/automation/followup-window';
import { formatBaht, type AutomationSummary } from './automation-types';

/** Label for a follow-up delay preset. */
function delayLabel(minutes: number): string {
  if (minutes >= 1440) return 'วันถัดไป';
  if (minutes >= 60) return `${minutes / 60} ชั่วโมงหลังเสร็จ`;
  return `${minutes} นาทีหลังเสร็จ`;
}

/**
 * "ข้อความอัตโนมัติถึงลูกค้า" section of /portal/line-settings: post-service
 * follow-up (every plan) and win-back (Professional+), with the monthly cap
 * that protects the shop's LINE OA message quota.
 */
export function AutomationSettingsCard() {
  const { push } = useToast();
  const { openPaywall, openUpgrade } = useUpgrade();
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [form, setForm] = useState<AutomationSummary['settings'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/automation');
      const json = (await res.json().catch(() => ({}))) as { data?: AutomationSummary };
      if (!res.ok || !json.data) {
        setLoadError(true);
        return;
      }
      setSummary(json.data);
      setForm(json.data.settings);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch('/api/automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, google_review_url: form.google_review_url?.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      const paywall = readPaywallDetail(res, json);
      if (paywall) return openPaywall(paywall);
      if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      push('บันทึกข้อความอัตโนมัติแล้ว');
      void load();
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <section id="automation" className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        โหลดการตั้งค่าข้อความอัตโนมัติไม่สำเร็จ{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          ลองใหม่
        </button>
      </section>
    );
  }
  if (!summary || !form) {
    return <section id="automation" className="mt-4 h-40 max-w-2xl animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />;
  }

  const locked = !summary.plan.winback_allowed;
  const usedPct = summary.cap.limit > 0 ? Math.min(100, Math.round((summary.cap.used / summary.cap.limit) * 100)) : 100;

  return (
    <section id="automation" className="mt-4 max-w-2xl scroll-mt-20 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-800">ข้อความอัตโนมัติถึงลูกค้า</h3>
        <p className="mt-1 text-xs text-slate-500">
          ระบบส่ง LINE ให้เองตามพฤติกรรมลูกค้า ทุกข้อความใช้โควตาข้อความของ LINE OA ร้าน จึงมีเพดานต่อเดือนด้านล่าง
        </p>
      </div>

      {!summary.migrated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">ฟีเจอร์นี้ยังไม่พร้อมใช้งานบนระบบ กรุณาแจ้งผู้ดูแลระบบ</p>
      )}

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.followup_enabled}
            onChange={(e) => setForm((s) => (s ? { ...s, followup_enabled: e.target.checked } : s))}
          />
          <span>
            ขอบคุณ + ขอรีวิว หลังใช้บริการ
            <span className="mt-0.5 block text-xs text-slate-500">
              เมื่อพนักงานกด &quot;เสร็จสิ้น&quot; ระบบส่งข้อความขอบคุณพร้อมปุ่มให้คะแนนร้านและปุ่มจองครั้งถัดไป ส่งครั้งเดียวต่อคิว
            </span>
          </span>
        </label>
        {form.followup_enabled && (
          <div className="mt-3 space-y-2 pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="followup_delay" className="text-xs font-medium text-slate-600">
                ส่งเมื่อ
              </label>
              <select
                id="followup_delay"
                className="input max-w-[14rem]"
                value={form.followup_delay_minutes}
                onChange={(e) => setForm((s) => (s ? { ...s, followup_delay_minutes: Number(e.target.value) } : s))}
              >
                {FOLLOWUP_DELAY_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {delayLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="google_review_url" className="text-xs font-medium text-slate-600">
                ลิงก์รีวิวร้าน (Google Maps / Facebook) — ไม่ใส่ก็ได้
              </label>
              <input
                id="google_review_url"
                className="input"
                placeholder="https://g.page/r/.../review"
                value={form.google_review_url ?? ''}
                onChange={(e) => setForm((s) => (s ? { ...s, google_review_url: e.target.value } : s))}
              />
            </div>
          </div>
        )}
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm text-slate-700 ${locked ? 'bg-slate-100' : 'bg-slate-50'}`}>
        <label className={`flex items-start gap-2 ${locked ? 'opacity-60' : ''}`}>
          <input
            type="checkbox"
            className="mt-1"
            disabled={locked}
            checked={form.winback_enabled && !locked}
            onChange={(e) => setForm((s) => (s ? { ...s, winback_enabled: e.target.checked } : s))}
          />
          <span>
            ดึงลูกค้าประจำที่หายไปให้กลับมา {locked && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[11px]">Professional</span>}
            <span className="mt-0.5 block text-xs text-slate-500">
              ระบบเรียนรู้รอบการมาของลูกค้าแต่ละคน (เช่น ตัดผมทุก 4 สัปดาห์) ถ้าเลยรอบแล้วยังไม่จอง จะส่ง LINE ชวนกลับมาวันละครั้งตอน 10:00
              ไม่ส่งซ้ำคนเดิมภายใน 30 วัน และไม่ส่งหาคนที่มีคิวรออยู่แล้ว
            </span>
          </span>
        </label>
        {summary.preview.overdue > 0 && (
          <p className="mt-2 pl-6 text-xs text-slate-700">
            ตอนนี้มีลูกค้าเลยรอบ <b>{summary.preview.overdue} คน</b> ทัก LINE ได้ {summary.preview.reachable} คน ≈{' '}
            {formatBaht(summary.preview.estimatedBaht)}
          </p>
        )}
        {locked ? (
          <div className="mt-2 pl-6">
            <button type="button" className="btn-outline" onClick={() => openUpgrade('automation')}>
              ขอเปิดใช้แพ็กเกจ Professional
            </button>
          </div>
        ) : (
          form.winback_enabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
              <label htmlFor="winback_default_days" className="text-xs font-medium text-slate-600">
                ลูกค้าที่เพิ่งมาครั้งเดียว ถือว่าหายไปเมื่อเกิน
              </label>
              <input
                id="winback_default_days"
                type="number"
                min={7}
                max={365}
                className="input max-w-[6rem]"
                value={form.winback_default_days}
                onChange={(e) => setForm((s) => (s ? { ...s, winback_default_days: Number(e.target.value) } : s))}
              />
              <span className="text-xs text-slate-600">วัน</span>
            </div>
          )
        )}
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="automation_monthly_cap" className="text-xs font-medium text-slate-600">
            เพดานข้อความอัตโนมัติต่อเดือน
          </label>
          <input
            id="automation_monthly_cap"
            type="number"
            min={0}
            max={100000}
            className="input max-w-[7rem]"
            value={form.automation_monthly_cap}
            onChange={(e) => setForm((s) => (s ? { ...s, automation_monthly_cap: Number(e.target.value) } : s))}
          />
          <span className="text-xs text-slate-600">ข้อความ</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div className={`h-full ${usedPct >= 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          เดือนนี้ใช้ไป {summary.cap.used.toLocaleString('th-TH')}/{summary.cap.limit.toLocaleString('th-TH')} ข้อความ
          {summary.cap.starter_ceiling && ' (แพ็กเกจ Starter ส่งได้สูงสุด 100 ข้อความ/เดือน)'}
          {summary.roi.total.converted > 0 &&
            ` · ลูกค้ากลับมาจอง ${summary.roi.total.converted} คิว ≈ ${formatBaht(summary.roi.total.revenue)}`}
        </p>
      </div>

      <button type="button" className="btn-primary" disabled={saving || !summary.migrated} onClick={() => void save()}>
        {saving ? 'กำลังบันทึก...' : 'บันทึกข้อความอัตโนมัติ'}
      </button>
    </section>
  );
}
