'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/utils/image-compress';

interface SlipInfo {
  id: string;
  status: string;
  reject_reason: string | null;
  amount_claimed: number | null;
  transferred_at: string | null;
  created_at: string;
  image_url: string | null;
}

interface PaymentState {
  booking_id: string;
  queue_number: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  payment_reject_reason: string | null;
  qr_image_url: string | null;
  payee: {
    promptpay_display_name: string | null;
    promptpay_masked: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
    bank_account_name: string | null;
  } | null;
  slip: SlipInfo | null;
}

/** Client-side ceiling before compression — anything larger is a mistake, not a slip. */
const MAX_RAW_BYTES = 12 * 1024 * 1024;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 30; // 5 minutes

function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountdown(expiresAt: string | null | undefined) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) return setLabel('');
    const tick = () => {
      const left = new Date(expiresAt).getTime() - Date.now();
      if (left <= 0) return setLabel('หมดเวลาชำระแล้ว');
      const h = Math.floor(left / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      setLabel(h > 0 ? `เหลือเวลา ${h} ชม. ${m} นาที` : `เหลือเวลา ${m} นาที`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

/**
 * Payment panel shown after a booking is made with the bank-transfer method:
 * the shop's PromptPay QR, the payee details, and the slip upload.
 */
export function LiffPaymentPanel({
  shopKey,
  bookingId,
  lineUserId,
  idToken,
  accent = '#4FA56A',
  onPaid,
}: {
  shopKey: string;
  bookingId: string;
  lineUserId: string;
  /** LIFF ID token — proves the claimed LINE id when the shop verifies tokens. */
  idToken?: string;
  accent?: string;
  onPaid?: () => void;
}) {
  const [state, setState] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [amountClaimed, setAmountClaimed] = useState('');
  const [transferredAt, setTransferredAt] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/shop/${shopKey}/payment/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, booking_id: bookingId, id_token: idToken || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลการชำระเงินไม่สำเร็จ');
      setState(json.data as PaymentState);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลการชำระเงินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopKey, bookingId, lineUserId, idToken]);

  useEffect(() => { void load(); }, [load]);

  // Poll only while a decision is pending, and give up rather than polling forever.
  useEffect(() => {
    if (state?.payment_status !== 'awaiting_verification' || pollCount >= MAX_POLLS) return;
    const id = setTimeout(() => {
      setPollCount((n) => n + 1);
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state?.payment_status, pollCount, load]);

  useEffect(() => {
    if (state?.payment_status === 'paid') onPaid?.();
  }, [state?.payment_status, onPaid]);

  const countdown = useCountdown(state?.payment_expires_at);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > MAX_RAW_BYTES) {
      setError('ไฟล์ใหญ่เกินไป กรุณาเลือกรูปสลิปที่เล็กกว่านี้');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(picked);
      const body = new FormData();
      body.append('line_user_id', lineUserId);
      body.append('booking_id', bookingId);
      if (idToken) body.append('id_token', idToken);
      body.append('file', compressed);
      if (amountClaimed) body.append('amount_claimed', amountClaimed);
      if (transferredAt) body.append('transferred_at', new Date(transferredAt).toISOString());

      const res = await fetch(`/api/public/shop/${shopKey}/payment/slip`, { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'อัปโหลดสลิปไม่สำเร็จ');
      setPollCount(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปโหลดสลิปไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">กำลังโหลดข้อมูลการชำระเงิน...</div>;
  }
  if (!state || state.payment_method !== 'bank_transfer') return null;

  const amount = Number(state.payment_amount ?? 0);
  const status = state.payment_status;

  // ── Paid ──
  if (status === 'paid') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-3xl">✓</p>
        <p className="mt-1 text-base font-bold text-green-700">ชำระเงินเรียบร้อยแล้ว</p>
        <p className="mt-1 text-sm text-green-700">{formatTHB(amount)} บาท</p>
      </div>
    );
  }

  // ── Waiting for the shop to review ──
  if (status === 'awaiting_verification') {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-base font-bold text-amber-800">รอร้านตรวจสอบสลิป</p>
        <p className="text-sm text-amber-800">ยอด {formatTHB(amount)} บาท — ร้านจะแจ้งผลผ่าน LINE</p>
        {state.slip?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.slip.image_url} alt="สลิปที่อัปโหลด" className="mx-auto max-h-52 rounded-lg border border-amber-200 bg-white" />
        )}
        <button
          className="btn-outline w-full"
          onClick={() => { setPollCount(0); void load(); }}
        >
          ตรวจสอบสถานะอีกครั้ง
        </button>
        {pollCount >= MAX_POLLS && (
          <p className="text-xs text-amber-700">หยุดตรวจสอบอัตโนมัติแล้ว กดปุ่มด้านบนเพื่อเช็คใหม่</p>
        )}
      </div>
    );
  }

  // ── pending_payment / rejected: show the QR and the upload form ──
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {status === 'rejected' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-700">สลิปไม่ผ่านการตรวจสอบ</p>
          {state.payment_reject_reason && (
            <p className="mt-1 text-xs text-rose-700">เหตุผล: {state.payment_reject_reason}</p>
          )}
          <p className="mt-1 text-xs text-rose-600">กรุณาอัปโหลดสลิปใหม่อีกครั้ง</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-slate-500">ยอดที่ต้องชำระ</p>
        <p className="text-3xl font-extrabold" style={{ color: accent }}>{formatTHB(amount)} บาท</p>
        {countdown && <p className="mt-1 text-xs text-slate-500">{countdown}</p>}
      </div>

      {state.qr_image_url && (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.qr_image_url}
            alt="PromptPay QR"
            className="h-56 w-56 rounded-xl border border-slate-200 bg-white"
          />
          <p className="mt-2 text-xs text-slate-500">สแกนด้วยแอปธนาคารเพื่อโอนเงิน</p>
        </div>
      )}

      {state.payee && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {state.payee.promptpay_display_name && <p>ผู้รับ: <b>{state.payee.promptpay_display_name}</b></p>}
          {state.payee.promptpay_masked && <p>PromptPay: {state.payee.promptpay_masked}</p>}
          {state.payee.bank_name && state.payee.bank_account_no && (
            <p>{state.payee.bank_name} {state.payee.bank_account_no}</p>
          )}
          {state.payee.bank_account_name && <p>ชื่อบัญชี: {state.payee.bank_account_name}</p>}
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-800">อัปโหลดสลิปการโอน</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">ยอดที่โอน (ไม่บังคับ)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder={String(amount)}
              value={amountClaimed}
              onChange={(e) => setAmountClaimed(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">เวลาที่โอน (ไม่บังคับ)</label>
            <input
              className="input"
              type="datetime-local"
              value={transferredAt}
              onChange={(e) => setTransferredAt(e.target.value)}
            />
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />
        <button
          className="btn-primary w-full"
          style={{ background: accent }}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'กำลังอัปโหลด...' : 'เลือกรูปสลิป'}
        </button>
        <p className="text-xs text-slate-400">รองรับ JPG, PNG, WebP — ไม่เกิน 5MB (ระบบจะย่อรูปให้อัตโนมัติ)</p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
