'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';

export default function LineSettingsPage() {
  const { push } = useToast();
  const [form, setForm] = useState({
    line_channel_access_token: '',
    line_channel_secret: '',
    liff_id: '',
    liff_id_login_shop: '',
    auto_reply_enabled: true,
    shop_key: '',
  });

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/line-settings');
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'โหลดไม่สำเร็จ', 'error');
      setForm({
        line_channel_access_token: json.data.line_channel_access_token ?? '',
        line_channel_secret: json.data.line_channel_secret ?? '',
        liff_id: json.data.liff_id ?? '',
        liff_id_login_shop: json.data.liff_id_login_shop ?? '',
        auto_reply_enabled: Boolean(json.data.auto_reply_enabled),
        shop_key: json.data.shop_key ?? '',
      });
    })();
  }, [push]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/line-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    push('บันทึกตั้งค่า LINE แล้ว');
  }

  return (
    <PageShell title="LINE Settings" description="ตั้งค่า LINE OA ต่อร้าน">
      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">ลิงก์สำหรับตั้งค่าใน LINE Developer</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>Webhook URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            https://queuebooking.com/api/line/webhook/{form.shop_key || '{shopKey}'}
          </code>
          <p>LIFF Booking URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            https://queuebooking.com/liff/{form.shop_key || '{shopKey}'}
          </code>
          <p>LIFF Member URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            https://queuebooking.com/liff/{form.shop_key || '{shopKey}'}/member
          </code>
        </div>
      </section>

      <form onSubmit={onSubmit} className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-800">ข้อมูลเชื่อมต่อ LINE OA</h3>
          <p className="mt-1 text-xs text-slate-500">กรอกค่า Channel และ LIFF ID ให้ตรงกับร้านนี้</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LINE Channel Access Token</label>
          <input className="input" placeholder="ใส่ Channel Access Token (Long-lived)" value={form.line_channel_access_token} onChange={(e) => setForm((s) => ({ ...s, line_channel_access_token: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LINE Channel Secret</label>
          <input className="input" placeholder="ใส่ Channel Secret" value={form.line_channel_secret} onChange={(e) => setForm((s) => ({ ...s, line_channel_secret: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LIFF Booking ID (`liff_id`)</label>
          <input className="input" placeholder="เช่น 200xxxxxxx-ABCDEFG" value={form.liff_id} onChange={(e) => setForm((s) => ({ ...s, liff_id: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LIFF Member/Login ID (`liff_id_login_shop`)</label>
          <input className="input" placeholder="เช่น 200xxxxxxx-HIJKLMN" value={form.liff_id_login_shop} onChange={(e) => setForm((s) => ({ ...s, liff_id_login_shop: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.auto_reply_enabled} onChange={(e) => setForm((s) => ({ ...s, auto_reply_enabled: e.target.checked }))} />
          เปิด Auto Reply
        </label>
        <div className="pt-1">
          <button className="btn-primary">บันทึก</button>
        </div>
      </form>
    </PageShell>
  );
}
