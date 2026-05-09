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
      <form onSubmit={onSubmit} className="card max-w-2xl p-4 space-y-3">
        <div className="text-sm text-slate-600">Webhook URL: <code>/api/line/webhook/{form.shop_key || '{shopKey}'}</code></div>
        <input className="input" placeholder="LINE Channel Access Token" value={form.line_channel_access_token} onChange={(e) => setForm((s) => ({ ...s, line_channel_access_token: e.target.value }))} />
        <input className="input" placeholder="LINE Channel Secret" value={form.line_channel_secret} onChange={(e) => setForm((s) => ({ ...s, line_channel_secret: e.target.value }))} />
        <input className="input" placeholder="LIFF ID" value={form.liff_id} onChange={(e) => setForm((s) => ({ ...s, liff_id: e.target.value }))} />
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={form.auto_reply_enabled} onChange={(e) => setForm((s) => ({ ...s, auto_reply_enabled: e.target.checked }))} />
          เปิด Auto Reply
        </label>
        <button className="btn-primary">บันทึก</button>
      </form>
    </PageShell>
  );
}
