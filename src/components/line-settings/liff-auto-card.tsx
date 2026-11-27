'use client';

import { FormEvent, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Props = {
  /** Called with the new IDs so the settings form shows them without a reload. */
  onProvisioned: (ids: { liffId: string; liffIdLoginShop: string }) => void;
};

/**
 * Owner pastes the LINE Login channel ID + secret; the server creates both
 * LIFF apps with the right endpoints and scopes and saves their IDs.
 */
export function LiffAutoCard({ onProvisioned }: Props) {
  const { push } = useToast();
  const [channelId, setChannelId] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch('/api/line-settings/liff-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_channel_id: channelId, login_channel_secret: channelSecret }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        push(json.error ?? 'สร้าง LIFF ไม่สำเร็จ', 'error');
        return;
      }
      const data = json.data as { liffId: string; liffIdLoginShop: string; created: string[]; updated: string[] };
      onProvisioned({ liffId: data.liffId, liffIdLoginShop: data.liffIdLoginShop });
      setChannelSecret('');
      const parts = [
        data.created.length ? `สร้างใหม่ ${data.created.length} ตัว` : '',
        data.updated.length ? `แก้ไข ${data.updated.length} ตัว` : '',
      ].filter(Boolean);
      setSummary(`จองคิว: ${data.liffId} · สมาชิก: ${data.liffIdLoginShop}${parts.length ? ` (${parts.join(', ')})` : ' (ใช้ของเดิม)'}`);
      push('ตั้งค่า LIFF ให้อัตโนมัติแล้ว');
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-2xl space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-sky-900">สร้าง LIFF อัตโนมัติ (จองคิว + สมาชิก)</h3>
        <p className="mt-1 text-xs text-sky-800">
          สร้าง <b>LINE Login channel</b> ใน LINE Developers โดยเลือก <b>Provider เดียวกับ LINE OA</b> ของร้าน
          แล้วนำ Channel ID และ Channel Secret ของ LINE Login channel มาวาง ระบบจะสร้าง LIFF ทั้ง 2 ตัวพร้อม endpoint และ scope ให้
          (ไม่เก็บ Channel Secret ไว้)
        </p>
        <p className="mt-1 text-xs text-amber-700">
          ถ้า Provider ไม่ตรงกับ OA ระบบจะส่งข้อความหาลูกค้าไม่ถึง เพราะ LINE ให้ user ID คนละชุดต่อ Provider
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">LINE Login Channel ID</label>
        <input className="input" inputMode="numeric" placeholder="เช่น 2001234567" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">LINE Login Channel Secret</label>
        <input className="input" type="password" autoComplete="off" placeholder="32 ตัวอักษร" value={channelSecret} onChange={(e) => setChannelSecret(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={busy || !channelId || !channelSecret}>
        {busy ? 'กำลังสร้าง LIFF...' : 'สร้าง LIFF ให้อัตโนมัติ'}
      </button>
      {summary && <p className="text-sm text-emerald-700">✓ {summary}</p>}
    </form>
  );
}
