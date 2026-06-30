'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';

interface PaymentSettings {
  qr_payment_enabled: boolean;
  omise_public_key: string;
  omise_secret_key: string;
  omise_secret_key_set: boolean;
  omise_secret_key_hint: string | null;
}

export default function PaymentSettingsPage() {
  const { push } = useToast();
  const [form, setForm] = useState<PaymentSettings>({
    qr_payment_enabled: false,
    omise_public_key: '',
    omise_secret_key: '',
    omise_secret_key_set: false,
    omise_secret_key_hint: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/shop-payment-settings');
      const json = await res.json();
      if (!res.ok) { push(json.error ?? 'โหลดไม่สำเร็จ', 'error'); return; }
      setForm({
        qr_payment_enabled: Boolean(json.data.qr_payment_enabled),
        omise_public_key: json.data.omise_public_key ?? '',
        omise_secret_key: '',
        omise_secret_key_set: Boolean(json.data.omise_secret_key_set),
        omise_secret_key_hint: json.data.omise_secret_key_hint ?? null,
      });
      setLoading(false);
    })();
  }, [push]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = {
      qr_payment_enabled: form.qr_payment_enabled,
      omise_public_key: form.omise_public_key,
    };
    if (form.omise_secret_key) body.omise_secret_key = form.omise_secret_key;
    const res = await fetch('/api/shop-payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    push('บันทึกตั้งค่าการชำระเงินแล้ว');
    if (form.omise_secret_key) {
      setForm((s) => ({ ...s, omise_secret_key: '', omise_secret_key_set: true, omise_secret_key_hint: `skey_...${form.omise_secret_key.slice(-4)}` }));
    }
  }

  const isTest =
    form.omise_public_key.startsWith('pkey_test_') ||
    (form.omise_secret_key_hint?.includes('skey_test_') ?? form.omise_public_key.startsWith('pkey_test_'));

  if (loading) return <PageShell title="Payment Settings"><p className="text-sm text-slate-500">กำลังโหลด...</p></PageShell>;

  return (
    <PageShell title="Payment Settings" description="ตั้งค่า QR Payment ด้วย Omise PromptPay">

      {/* Status banner */}
      <div className={`max-w-2xl rounded-xl px-4 py-3 text-sm font-medium ${form.qr_payment_enabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        {form.qr_payment_enabled ? '✓ QR Payment เปิดอยู่ — ระบบจะสร้าง PromptPay QR และส่งให้ลูกค้าผ่าน LINE หลังจองสำเร็จ' : 'QR Payment ปิดอยู่ — ลูกค้าจองโดยไม่ต้องชำระล่วงหน้า'}
      </div>

      {isTest && (
        <div className="max-w-2xl rounded-xl px-4 py-3 text-sm bg-amber-50 text-amber-700 border border-amber-200">
          🧪 <strong>Test Mode</strong> — ใช้ Omise test keys กำลังทดสอบระบบ ไม่มีการตัดเงินจริง
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-2 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
        {/* Toggle */}
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
          <input
            id="qr-toggle"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-blue-600"
            checked={form.qr_payment_enabled}
            onChange={(e) => setForm((s) => ({ ...s, qr_payment_enabled: e.target.checked }))}
          />
          <label htmlFor="qr-toggle" className="cursor-pointer">
            <span className="text-sm font-semibold text-slate-800">เปิด QR Payment (PromptPay)</span>
            <p className="mt-0.5 text-xs text-slate-500">
              เมื่อลูกค้าจองสำเร็จ ระบบจะสร้าง QR PromptPay และส่งผ่าน LINE ทันที<br />
              เมื่อลูกค้าชำระแล้ว ระบบส่งใบเสร็จรับเงินผ่าน LINE และอัปเดตสถานะหลังบ้าน
            </p>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Omise API Keys</h3>
          <p className="mt-1 text-xs text-slate-500">
            ใช้ <strong>Test Keys</strong> สำหรับทดสอบ (<code>pkey_test_...</code> / <code>skey_test_...</code>)<br />
            เปลี่ยนเป็น <strong>Live Keys</strong> เมื่อพร้อม go-live (<code>pkey_...</code> / <code>skey_...</code>)
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Public Key</label>
          <input
            className="input"
            placeholder="pkey_test_xxxxxxxx หรือ pkey_xxxxxxxx"
            value={form.omise_public_key}
            onChange={(e) => setForm((s) => ({ ...s, omise_public_key: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            Secret Key{form.omise_secret_key_set && <span className="ml-2 text-green-600 font-normal">✓ ตั้งค่าแล้ว {form.omise_secret_key_hint ? `(${form.omise_secret_key_hint})` : ''}</span>}
          </label>
          <input
            className="input"
            type="password"
            placeholder={form.omise_secret_key_set ? 'กรอกใหม่เพื่อเปลี่ยน Secret Key' : 'skey_test_xxxxxxxx หรือ skey_xxxxxxxx'}
            value={form.omise_secret_key}
            onChange={(e) => setForm((s) => ({ ...s, omise_secret_key: e.target.value }))}
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-400">Secret Key ถูกเก็บเข้ารหัสและแสดงเฉพาะ 4 ตัวท้าย</p>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Omise Webhook</h3>
          <p className="mt-1 text-xs text-slate-500">ตั้งค่า Webhook URL นี้ใน Omise Dashboard เพื่อรับแจ้งเตือนเมื่อลูกค้าชำระเงินสำเร็จ</p>
          <code className="mt-2 block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 break-all">
            {(process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com').replace(/\/+$/, '')}/api/payments/webhook
          </code>
        </div>

        <div className="pt-1">
          <button className="btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
