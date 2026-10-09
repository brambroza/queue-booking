'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useUpgrade } from '@/components/subscription/upgrade-provider';

export interface SlipVerifyProviderView {
  provider: string;
  display_name: string;
  available: boolean;
  enabled: boolean;
  credentials_set: boolean;
  credentials_hint: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

export interface SlipVerifyView {
  source: 'shop' | 'platform' | 'none';
  provider: string | null;
  plan_locked: boolean;
  plan_code: string | null;
  platform_available: boolean;
  credentials_key_configured: boolean;
  providers: SlipVerifyProviderView[];
}

const ONBOARDING: Record<string, string[]> = {
  easyslip: [
    'สมัครที่ easyslip.com แล้วยืนยันตัวตน (KYC) ตามที่ผู้ให้บริการกำหนด',
    'สร้าง Application → คัดลอก API Key มาวางด้านล่าง',
    'เติมโควต้า/เลือกแพ็กเกจกับผู้ให้บริการ (คิดเป็นรายครั้งที่ตรวจ)',
    'กด "ทดสอบการเชื่อมต่อ" — ระบบจะเช็ก key และโควต้าที่เหลือโดยไม่กินโควต้า',
  ],
};

function SourceBadge({ view }: { view: SlipVerifyView }) {
  if (view.source === 'platform') {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ ใช้ระบบกลาง (รวมในแพ็กเกจ)</span>;
  }
  if (view.source === 'shop') {
    const row = view.providers.find((p) => p.provider === view.provider);
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        ✓ ใช้ API key ของร้าน{row?.credentials_hint ? ` (…${row.credentials_hint})` : ''}
      </span>
    );
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">ยังไม่เปิดใช้</span>;
}

/**
 * Settings card for the slip verification key. Saves independently of the main
 * payment form; the key is cleared from the input as soon as it is stored.
 */
export function SlipVerifyCard({ view, onSaved }: { view: SlipVerifyView; onSaved: () => void }) {
  const { push } = useToast();
  const { openUpgrade } = useUpgrade();
  const vendor = view.providers[0];
  const [enabled, setEnabled] = useState(vendor?.enabled ?? false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => setEnabled(vendor?.enabled ?? false), [vendor?.enabled]);

  if (!vendor) return null;

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = { provider: vendor.provider, enabled };
    if (apiKey.trim()) body.credentials = { apiKey: apiKey.trim() };
    const res = await fetch('/api/shop-payment-settings/slip-verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res) return push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    setApiKey('');
    push('บันทึกการตั้งค่าตรวจสลิปอัตโนมัติแล้ว');
    onSaved();
  }

  async function testConnection() {
    setTesting(true);
    const res = await fetch('/api/shop-payment-settings/slip-verify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: vendor.provider }),
    }).catch(() => null);
    setTesting(false);
    if (!res) return push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'เชื่อมต่อไม่สำเร็จ', 'error');
    push(`เชื่อมต่อ ${vendor.display_name} สำเร็จ${json.data?.detail ? ` — ${json.data.detail}` : ''}`);
    onSaved();
  }

  const misconfigured = enabled && !vendor.credentials_set && !apiKey.trim();

  return (
    <section id="slip-verify" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">ตรวจสลิปอัตโนมัติกับธนาคาร</h2>
          <p className="mt-1 text-xs text-slate-500">
            ระบบอ่าน QR บนสลิป แล้วถามผู้ให้บริการที่เชื่อมกับธนาคารว่ามีรายการโอนจริง ยอดตรง และเข้าบัญชีร้านนี้
            ถ้าครบทุกข้อจะอนุมัติให้ทันที ที่เหลือเข้าคิวให้คนตรวจ — ไม่มีการปฏิเสธอัตโนมัติ
          </p>
        </div>
        <SourceBadge view={view} />
      </div>

      {view.source === 'none' && view.plan_locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-medium">แพ็กเกจปัจจุบันยังไม่รวมการตรวจสลิปอัตโนมัติ</p>
          <p className="mt-1">อัปเกรดเป็น Professional ขึ้นไปเพื่อใช้ระบบกลางได้ทันที หรือใส่ {vendor.display_name} API key ของร้านเองด้านล่าง (ใช้ได้ทุกแพ็กเกจ)</p>
          <button type="button" className="btn-primary mt-2 !py-1 !text-xs" onClick={() => openUpgrade('settings')}>
            ดูแพ็กเกจ
          </button>
        </div>
      )}
      {view.source === 'none' && !view.plan_locked && !view.platform_available && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          ระบบกลางยังไม่ได้ตั้งค่า key ตรวจสลิป (แจ้งผู้ดูแลระบบ) — ร้านยังใส่ key ของตัวเองด้านล่างได้
        </div>
      )}
      {!vendor.available && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          ผู้ให้บริการนี้ถูกปิดใช้ชั่วคราวในระบบ — บันทึก key ไว้ล่วงหน้าได้ แต่ยังไม่ทำงาน
        </div>
      )}
      {!view.credentials_key_configured && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          ระบบยังไม่ได้ตั้งค่า key สำหรับเข้ารหัส credentials — บันทึก API key ของร้านไม่ได้ (แจ้งผู้ดูแลระบบ)
        </div>
      )}
      {misconfigured && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          ⚠️ เปิดใช้ key ของร้านไว้ แต่ยังไม่ได้ใส่ API key
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
        <input
          id="slip-verify-own-key"
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-blue-600"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <label htmlFor="slip-verify-own-key" className="cursor-pointer">
          <span className="text-sm font-semibold text-slate-800">ใช้ {vendor.display_name} API key ของร้านเอง</span>
          <p className="mt-0.5 text-xs text-slate-500">
            key ของร้านจะถูกใช้ก่อนระบบกลางเสมอ (โควต้าเป็นของร้าน) — ปิดไว้ = ใช้ระบบกลางตามแพ็กเกจ
          </p>
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">
          {vendor.display_name} API Key
          {vendor.credentials_set && (
            <span className="ml-2 font-normal text-green-600">✓ ตั้งค่าแล้ว {vendor.credentials_hint ? `(…${vendor.credentials_hint})` : ''}</span>
          )}
        </label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder={vendor.credentials_set ? 'กรอกใหม่เพื่อเปลี่ยน' : 'วาง API key จาก easyslip.com'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="text-xs text-slate-400">
          เก็บแบบเข้ารหัสและไม่ถูกส่งกลับมาที่หน้าจอนี้อีก
          {vendor.last_test_at && (
            <span className={vendor.last_test_ok ? ' text-green-600' : ' text-red-600'}>
              {' '}· ทดสอบล่าสุด {new Date(vendor.last_test_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} {vendor.last_test_ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}
            </span>
          )}
        </p>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">ขั้นตอนสมัคร {vendor.display_name}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {(ONBOARDING[vendor.provider] ?? []).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </details>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตรวจสลิป'}
        </button>
        <button type="button" className="btn-outline" disabled={testing || !vendor.credentials_set} onClick={() => void testConnection()}>
          {testing ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
        </button>
      </div>
    </section>
  );
}
