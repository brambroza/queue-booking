'use client';

import { useCallback, useEffect, useState } from 'react';

interface ReturnState {
  queue_number: string;
  payment_status: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  provider: string | null;
  provider_name: string | null;
  deeplink_url: string | null;
  shop: { name: string | null; shop_key: string; liff_id: string | null; liff_id_login_shop: string | null };
}

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 40; // 2 minutes

function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const m = input.trim().match(/liff\.line\.me\/([^/?#]+)/);
  return m?.[1] ?? input.trim();
}

/** Deep link back into the LIFF account tab, so the customer lands where their queue is. */
function buildLineReturnUrl(state: ReturnState | null, shopKey: string) {
  const candidates = [state?.shop.liff_id_login_shop, state?.shop.liff_id, process.env.NEXT_PUBLIC_LIFF_ID]
    .map(normalizeLiffId)
    .filter((v) => /^[0-9]{6,}-[A-Za-z0-9_-]{4,}$/.test(v));
  const liffId = candidates[0];
  if (!liffId) return null;
  const params = new URLSearchParams({ shop_key: shopKey, tab: 'account' });
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

export function DeeplinkReturnClient({ shopKey, bookingId, token }: { shopKey: string; bookingId: string; token: string }) {
  const [state, setState] = useState<ReturnState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const load = useCallback(async () => {
    if (!bookingId || !token) {
      setError('ลิงก์ไม่ถูกต้อง');
      setLoading(false);
      return;
    }
    try {
      const qs = new URLSearchParams({ booking_id: bookingId, t: token });
      const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/payment/deeplink-return?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === 'Not found' ? 'ไม่พบข้อมูลการชำระเงิน' : 'ตรวจสอบสถานะไม่สำเร็จ');
      setState(json.data as ReturnState);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจสอบสถานะไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopKey, bookingId, token]);

  useEffect(() => { void load(); }, [load]);

  // Keep asking while the bank has not confirmed yet, then stop and let the customer retry by hand.
  useEffect(() => {
    if (state?.payment_status !== 'pending_payment' || pollCount >= MAX_POLLS) return;
    const id = setTimeout(() => {
      setPollCount((n) => n + 1);
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state?.payment_status, pollCount, load]);

  const lineUrl = buildLineReturnUrl(state, shopKey);
  const status = state?.payment_status ?? null;
  const amount = Number(state?.payment_amount ?? 0);

  return (
    <main className="min-h-screen p-4" style={{ background: '#f4f6f8' }}>
      <section className="mx-auto mt-6 max-w-md overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 text-white" style={{ background: '#4FA56A' }}>
          <p className="text-xs opacity-90">{state?.shop.name ?? 'ร้านค้า'}</p>
          <h1 className="text-base font-semibold">สถานะการชำระเงิน</h1>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {loading && <p className="text-slate-500">กำลังตรวจสอบกับธนาคาร...</p>}

          {!loading && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
          )}

          {!loading && state && status === 'paid' && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
              <p className="text-3xl">✓</p>
              <p className="mt-1 text-base font-bold text-green-700">ชำระเงินสำเร็จ</p>
              <p className="mt-1 text-green-700">คิว {state.queue_number} · {formatTHB(amount)} บาท</p>
              <p className="mt-2 text-xs text-green-700">ใบเสร็จถูกส่งไปที่ LINE ของคุณแล้ว</p>
            </div>
          )}

          {!loading && state && status === 'pending_payment' && (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-base font-bold text-amber-800">รอธนาคารยืนยัน</p>
              <p className="text-amber-800">คิว {state.queue_number} · ยอด {formatTHB(amount)} บาท</p>
              {pollCount < MAX_POLLS ? (
                <p className="text-xs text-amber-700">ระบบตรวจสอบอัตโนมัติทุก 3 วินาที หากชำระแล้วสถานะจะเปลี่ยนเอง</p>
              ) : (
                <p className="text-xs text-amber-700">หยุดตรวจสอบอัตโนมัติแล้ว กดปุ่มด้านล่างเพื่อเช็คใหม่</p>
              )}
              <button className="btn-outline w-full" onClick={() => { setPollCount(0); void load(); }}>ตรวจสอบอีกครั้ง</button>
              {state.deeplink_url && (
                <a className="btn-primary block w-full text-center" style={{ background: '#1d4ed8' }} href={state.deeplink_url}>
                  เปิดแอป {state.provider_name ?? 'ธนาคาร'} อีกครั้ง
                </a>
              )}
            </div>
          )}

          {!loading && state && status !== 'paid' && status !== 'pending_payment' && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-base font-bold text-rose-700">การชำระเงินไม่สำเร็จ</p>
              <p className="mt-1 text-rose-700">คิว {state.queue_number} — กลับไปที่ LINE เพื่อออกลิงก์ชำระเงินใหม่</p>
            </div>
          )}

          {lineUrl && (
            <a className="btn-primary block w-full text-center" style={{ background: '#06C755' }} href={lineUrl}>
              กลับไป LINE
            </a>
          )}
          {!lineUrl && !loading && (
            <p className="text-center text-xs text-slate-500">ปิดหน้านี้แล้วกลับไปที่ LINE เพื่อดูคิวของคุณ</p>
          )}
        </div>
      </section>
    </main>
  );
}
