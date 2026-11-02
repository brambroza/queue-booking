'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

type OwnerLineStatus = {
  available: boolean;
  line_connected?: boolean;
  linked?: boolean;
  display_name?: string | null;
  linked_at?: string | null;
  code_pending_until?: string | null;
};

type LinkCode = { code: string; message: string; expires_at: string; oa_message_url: string | null };

/** "2 พ.ย. 14:05" in Bangkok time. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * "LINE เจ้าของร้าน" section of /portal/line-settings: link the owner's own
 * LINE (by sending a one-time code to the shop's OA) so alerts such as
 * "booking quota 80 % used" reach their phone, not only the portal bell.
 */
export function OwnerLineCard() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<OwnerLineStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/owner-line');
      const json = (await res.json().catch(() => ({}))) as { data?: OwnerLineStatus };
      if (!res.ok || !json.data) return setLoadError(true);
      setStatus(json.data);
      setLoadError(false);
      if (json.data.linked) setLinkCode(null);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While a code is shown, look for the link every 5 s so the card flips by itself.
  useEffect(() => {
    if (!linkCode) return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [linkCode, load]);

  async function post(action: 'create_code' | 'test') {
    setBusy(true);
    try {
      const res = await fetch('/api/owner-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: LinkCode; error?: string };
      if (!res.ok) return push(json.error ?? 'ทำรายการไม่สำเร็จ', 'error');
      if (action === 'create_code' && json.data) setLinkCode(json.data);
      if (action === 'test') push('ส่งข้อความทดสอบแล้ว ดูใน LINE ของคุณ');
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    await confirm({
      tone: 'warning',
      title: 'ยกเลิกการเชื่อม LINE เจ้าของร้าน?',
      description: 'การแจ้งเตือนจะยังขึ้นที่กระดิ่งในระบบหลังร้าน แต่จะไม่ส่งเข้า LINE นี้อีก',
      context: { primary: status?.display_name ?? 'LINE เจ้าของร้าน' },
      confirmLabel: 'ยกเลิกการเชื่อม',
      cancelLabel: 'ไม่ยกเลิก',
      onConfirm: async () => {
        const res = await fetch('/api/owner-line', { method: 'DELETE' });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? 'ยกเลิกการเชื่อมไม่สำเร็จ');
        }
        push('ยกเลิกการเชื่อม LINE เจ้าของร้านแล้ว');
        await load();
      },
    });
  }

  async function copyMessage() {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode.message);
      push('คัดลอกรหัสแล้ว');
    } catch {
      push('คัดลอกไม่สำเร็จ กรุณาพิมพ์รหัสเอง', 'warning');
    }
  }

  const shell = 'mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

  if (loadError) {
    return (
      <section id="owner-line" className={`${shell} text-sm text-slate-600`}>
        โหลดการตั้งค่า LINE เจ้าของร้านไม่สำเร็จ{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          ลองใหม่
        </button>
      </section>
    );
  }
  if (!status) return <section id="owner-line" className={`${shell} text-sm text-slate-500`}>กำลังโหลด…</section>;
  if (!status.available) {
    return (
      <section id="owner-line" className={`${shell} text-sm text-slate-600`}>
        แจ้งเตือนเจ้าของร้านทาง LINE ยังไม่พร้อมใช้งาน (รอผู้ดูแลระบบอัปเดตฐานข้อมูล)
      </section>
    );
  }

  return (
    <section id="owner-line" className={`${shell} space-y-3`}>
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-800">LINE เจ้าของร้าน (รับแจ้งเตือน)</h3>
        <p className="mt-1 text-xs text-slate-500">
          ระบบจะส่งเรื่องสำคัญเข้า LINE ของเจ้าของร้านผ่าน LINE OA ของร้าน เช่น โควต้าการจองใช้ไป 80% / 90% / เต็ม
          และเมื่อมีคนจองไม่ได้เพราะโควต้าเต็ม (วันละครั้ง) — กระดิ่งในระบบหลังร้านยังแจ้งตามปกติ
        </p>
      </div>

      {!status.line_connected && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">ตั้งค่า Channel Access Token ด้านบนก่อน จึงจะเชื่อม LINE เจ้าของร้านได้</p>
      )}

      {status.linked ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ เชื่อมแล้ว{status.display_name ? ` กับ ${status.display_name}` : ''}
            {status.linked_at ? ` (${formatTime(status.linked_at)})` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void post('test')}>
              ส่งข้อความทดสอบ
            </button>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void post('create_code')}>
              เปลี่ยนเป็น LINE อื่น
            </button>
            <button type="button" className="btn-outline" onClick={() => void unlink()}>
              ยกเลิกการเชื่อม
            </button>
          </div>
        </div>
      ) : (
        !linkCode && (
          <button type="button" className="btn-primary" disabled={busy || !status.line_connected} onClick={() => void post('create_code')}>
            {busy ? 'กำลังสร้างรหัส…' : 'เชื่อม LINE เจ้าของร้าน'}
          </button>
        )
      )}

      {linkCode && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            1. แอดเพื่อน LINE OA ของร้าน (ถ้ายังไม่ได้แอด) จากมือถือของเจ้าของร้าน
            <br />
            2. ส่งข้อความนี้เข้าแชทของ LINE OA ร้าน ภายใน {formatTime(linkCode.expires_at)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-2 text-base font-semibold tracking-wider text-slate-900">{linkCode.message}</code>
            <button type="button" className="btn-outline" onClick={() => void copyMessage()}>
              คัดลอก
            </button>
            {linkCode.oa_message_url && (
              <a className="btn-primary" href={linkCode.oa_message_url} target="_blank" rel="noopener noreferrer">
                เปิด LINE แล้วส่งรหัส
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">
            รหัสใช้ได้ครั้งเดียว · หน้านี้จะเปลี่ยนเป็น &quot;เชื่อมแล้ว&quot; เองเมื่อระบบได้รับข้อความ · ส่งรหัสได้แม้ปิด Auto Reply
          </p>
        </div>
      )}
    </section>
  );
}
