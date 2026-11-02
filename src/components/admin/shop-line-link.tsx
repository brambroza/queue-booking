'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

/**
 * super_admin pieces for /portal/shop-subscriptions: link each shop owner's
 * LINE to the platform OA (QueueBooking) so owner alerts reach them even when
 * the shop has no OA of its own. Data from `/api/admin/shop-line`.
 */

export type ShopLineStatus = {
  platform: { linked: boolean; display_name: string | null; linked_at: string | null; code_pending_until: string | null };
  shop_oa: { linked: boolean; display_name: string | null };
};

export type PlatformOa = { configured: boolean; basic_id: string | null; add_friend_url: string | null; webhook_url: string };

type ShopLineData = { available: boolean; platform_oa: PlatformOa; shops: Record<string, ShopLineStatus> };

type LinkCode = {
  code: string;
  message: string;
  expires_at: string;
  basic_id: string | null;
  add_friend_url: string | null;
  oa_message_url: string | null;
};

const TONE = { ok: '#059669', warn: '#d97706', muted: 'var(--muted)' } as const;

/** "2 พ.ย. 14:05" in Bangkok time. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Load link status for every shop; `reload` after any change. */
export function useShopLineStatuses() {
  const [data, setData] = useState<ShopLineData | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop-line', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { data?: ShopLineData };
      if (!res.ok || !json.data) return setError(true);
      setData(json.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload };
}

/** Copy to clipboard with a toast either way. */
function useCopy() {
  const { push } = useToast();
  return async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      push(`คัดลอก${label}แล้ว`);
    } catch {
      push('คัดลอกไม่สำเร็จ', 'warning');
    }
  };
}

/** Top-of-page note: the platform OA's webhook URL and whether env is set. */
export function PlatformOaSetup({ data, error }: { data: ShopLineData | null; error: boolean }) {
  const copy = useCopy();
  if (error) return <p className="mt-3 text-xs" style={{ color: TONE.warn }}>โหลดสถานะ LINE OA QueueBooking ไม่สำเร็จ</p>;
  if (!data) return null;
  const oa = data.platform_oa;
  return (
    <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium" style={{ color: 'var(--text)' }}>
          LINE OA QueueBooking {oa.basic_id ?? ''}
        </span>
        <span style={{ color: oa.configured ? TONE.ok : TONE.warn }}>
          {oa.configured ? 'ตั้งค่า token + secret แล้ว' : 'ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET'}
        </span>
        {!data.available ? <span style={{ color: TONE.warn }}>ยังไม่ได้รัน migration 202611020003</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span>Webhook URL (ใส่ใน LINE Developers ของ OA นี้ แล้วเปิด Use webhook):</span>
        <code className="rounded px-2 py-0.5" style={{ background: 'var(--surface-soft)', color: 'var(--text)' }}>
          {oa.webhook_url}
        </code>
        <button type="button" className="btn-outline !px-2 !py-0.5 text-xs" onClick={() => void copy(oa.webhook_url, ' Webhook URL ')}>
          คัดลอก
        </button>
      </div>
    </div>
  );
}

/** Table cell: where this shop's owner alerts go. */
export function ShopLineCell({ status }: { status: ShopLineStatus | undefined }) {
  if (!status) return <span className="text-xs" style={{ color: TONE.muted }}>-</span>;
  const { platform, shop_oa: shopOa } = status;
  return (
    <div className="space-y-0.5 text-xs whitespace-nowrap">
      {platform.linked ? (
        <div style={{ color: TONE.ok }}>✓ QueueBooking{platform.display_name ? ` · ${platform.display_name}` : ''}</div>
      ) : platform.code_pending_until ? (
        <div style={{ color: TONE.warn }}>รอเจ้าของส่งรหัส</div>
      ) : (
        <div style={{ color: TONE.muted }}>ยังไม่เชื่อม QueueBooking</div>
      )}
      {shopOa.linked ? <div style={{ color: TONE.muted }}>✓ OA ร้าน{shopOa.display_name ? ` · ${shopOa.display_name}` : ''}</div> : null}
    </div>
  );
}

/**
 * Drawer section for one shop: create a link code to send the owner, test,
 * unlink. Polls while a code is pending so the panel flips by itself.
 */
export function ShopLinePanel({
  shopId,
  shopName,
  status,
  oa,
  available,
  onChanged,
}: {
  shopId: string;
  shopName: string;
  status: ShopLineStatus | undefined;
  oa: PlatformOa | undefined;
  available: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { push } = useToast();
  const confirm = useConfirm();
  const copy = useCopy();
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [busy, setBusy] = useState<'' | 'create_code' | 'test'>('');

  const linked = Boolean(status?.platform.linked);

  useEffect(() => {
    setLinkCode(null);
  }, [shopId]);

  useEffect(() => {
    if (linked) setLinkCode(null);
  }, [linked]);

  useEffect(() => {
    if (!linkCode) return;
    const id = window.setInterval(() => void onChanged(), 5000);
    return () => window.clearInterval(id);
  }, [linkCode, onChanged]);

  async function post(action: 'create_code' | 'test') {
    setBusy(action);
    try {
      const res = await fetch('/api/admin/shop-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: LinkCode; error?: string };
      if (!res.ok) return push(json.error ?? 'ทำรายการไม่สำเร็จ', 'error');
      if (action === 'create_code' && json.data) {
        setLinkCode(json.data);
        void onChanged();
      }
      if (action === 'test') push('ส่งข้อความทดสอบถึงเจ้าของร้านแล้ว');
    } catch {
      push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusy('');
    }
  }

  async function unlink() {
    await confirm({
      tone: 'warning',
      title: 'ยกเลิกการเชื่อม LINE เจ้าของร้านกับ QueueBooking?',
      description: 'แจ้งเตือนของร้านนี้จะไม่ส่งผ่าน OA QueueBooking อีก (ถ้าร้านผูก LINE กับ OA ของร้านไว้ จะส่งทางนั้นแทน)',
      context: { primary: shopName, secondary: status?.platform.display_name ?? undefined },
      confirmLabel: 'ยกเลิกการเชื่อม',
      cancelLabel: 'ไม่ยกเลิก',
      onConfirm: async () => {
        const res = await fetch('/api/admin/shop-line', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: shopId }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? 'ยกเลิกการเชื่อมไม่สำเร็จ');
        }
        push('ยกเลิกการเชื่อมแล้ว');
        await onChanged();
      },
    });
  }

  /** Ready-to-paste message for the admin to send the owner (LINE / SMS). */
  function ownerInstructions(code: LinkCode): string {
    const lines = [`ร้าน ${shopName}: เชื่อม LINE เพื่อรับแจ้งเตือนจาก QueueBooking`];
    if (code.add_friend_url) lines.push(`1. แอดเพื่อน QueueBooking: ${code.add_friend_url}`);
    lines.push(`${code.add_friend_url ? '2' : '1'}. ส่งข้อความนี้ในแชท QueueBooking ภายใน ${formatTime(code.expires_at)}: ${code.message}`);
    if (code.oa_message_url) lines.push(`หรือกดลิงก์นี้บนมือถือ: ${code.oa_message_url}`);
    return lines.join('\n');
  }

  const disabled = !available || !oa?.configured;

  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-soft)' }}>
      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--muted)' }}>
        LINE เจ้าของร้าน (รับแจ้งเตือนผ่าน OA QueueBooking)
      </p>
      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        เช่น โควต้าการจองใช้ไป 80% / 90% / เต็ม และมีคนจองไม่ได้เพราะโควต้าเต็ม ส่งทาง QueueBooking ก่อน ถ้าไม่ได้เชื่อมจะใช้ OA ของร้าน
      </p>

      {!available ? (
        <p className="text-sm" style={{ color: TONE.warn }}>ยังไม่พร้อม — ต้องรัน migration 202611020003 ก่อน</p>
      ) : !oa?.configured ? (
        <p className="text-sm" style={{ color: TONE.warn }}>ยังไม่ได้ตั้งค่า token / secret ของ OA QueueBooking ใน env</p>
      ) : null}

      {linked ? (
        <p className="mb-3 text-sm" style={{ color: TONE.ok }}>
          ✓ เชื่อมแล้ว{status?.platform.display_name ? ` กับ ${status.platform.display_name}` : ''}
          {status?.platform.linked_at ? ` (${formatTime(status.platform.linked_at)})` : ''}
        </p>
      ) : (
        <p className="mb-3 text-sm" style={{ color: 'var(--text)' }}>
          ยังไม่เชื่อม{status?.shop_oa.linked ? ` · ตอนนี้แจ้งผ่าน OA ของร้าน (${status.shop_oa.display_name ?? 'เชื่อมแล้ว'})` : ' · ตอนนี้แจ้งเฉพาะกระดิ่งในระบบ'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={linked ? 'btn-outline' : 'btn-primary'} disabled={disabled || Boolean(busy)} onClick={() => void post('create_code')}>
          {busy === 'create_code' ? 'กำลังสร้างรหัส…' : linked ? 'สร้างรหัสใหม่ (เปลี่ยน LINE)' : 'สร้างรหัสเชื่อม LINE'}
        </button>
        {linked ? (
          <>
            <button type="button" className="btn-outline" disabled={Boolean(busy)} onClick={() => void post('test')}>
              {busy === 'test' ? 'กำลังส่ง…' : 'ส่งข้อความทดสอบ'}
            </button>
            <button type="button" className="btn-outline" onClick={() => void unlink()}>
              ยกเลิกการเชื่อม
            </button>
          </>
        ) : null}
      </div>

      {linkCode ? (
        <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--text)' }}>
            ส่งรหัสนี้ให้เจ้าของร้าน ให้แอดเพื่อน {linkCode.basic_id ?? 'OA QueueBooking'} แล้วส่งรหัสในแชท ภายใน {formatTime(linkCode.expires_at)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded px-3 py-1.5 text-base font-semibold tracking-wider" style={{ background: 'var(--surface-soft)', color: 'var(--text)' }}>
              {linkCode.message}
            </code>
            <button type="button" className="btn-outline" onClick={() => void copy(linkCode.message, 'รหัส')}>
              คัดลอกรหัส
            </button>
            <button type="button" className="btn-primary" onClick={() => void copy(ownerInstructions(linkCode), 'ข้อความสำหรับส่งเจ้าของร้าน')}>
              คัดลอกข้อความส่งเจ้าของร้าน
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            รหัสใช้ได้ครั้งเดียว · ช่องนี้เปลี่ยนเป็น &quot;เชื่อมแล้ว&quot; เองเมื่อ OA ได้รับรหัส
          </p>
        </div>
      ) : null}
    </div>
  );
}
