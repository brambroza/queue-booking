/**
 * Decide what an uploaded slip's evidence is worth. Pure — no I/O.
 *
 * The rule that matters: **a slip is only auto-approved on bank-side evidence.**
 * Everything readable from the image (QR structure, CRC, reference number) can
 * be produced by anyone with a QR generator, so local checks alone can raise a
 * flag or reassure a reviewer but never move money to "paid". Fail-safe
 * direction is always manual review; nothing here auto-rejects.
 */
import type { SlipQrParseResult } from './slip-qr';
import type { SlipProviderResult } from './provider';

export type SlipCheckKey =
  | 'qr_found'
  | 'qr_format'
  | 'qr_crc'
  | 'country'
  | 'sending_bank'
  | 'not_duplicate'
  | 'amount_claimed'
  | 'within_window'
  | 'bank_found'
  | 'bank_amount'
  | 'bank_receiver'
  | 'bank_time';

export type SlipCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface SlipCheck {
  key: SlipCheckKey;
  status: SlipCheckStatus;
  /** Short Thai explanation shown to the reviewer. */
  detail: string;
}

/**
 * - `verified`   bank confirmed amount + receiver + time → safe to auto-approve
 * - `plausible`  well-formed, unseen slip QR; amount/receiver NOT confirmed
 * - `suspicious` a check actively failed (duplicate, bad CRC, bank mismatch)
 * - `unreadable` no slip QR could be read — says nothing either way
 * - `error`      the check itself crashed
 */
export type SlipAutoCheckStatus = 'verified' | 'plausible' | 'suspicious' | 'unreadable' | 'error';

export interface SlipEvaluation {
  status: SlipAutoCheckStatus;
  autoApprove: boolean;
  checks: SlipCheck[];
  /** Amount confirmed by the bank, when there is one. */
  verifiedAmountTHB: number | null;
  providerId: string | null;
}

export type SlipProviderOutcome =
  | { id: string; result: SlipProviderResult }
  | { id: string; error: string };

export interface SlipEvaluationInput {
  /** Text decoded from the image, or null when no QR was readable. */
  qrPayload: string | null;
  parsed: SlipQrParseResult | null;
  /** Another live slip (pending/approved, any booking but this one) already carries this reference. */
  duplicate: boolean;
  expectedAmountTHB: number;
  amountClaimedTHB: number | null;
  uploadedAt: Date;
  paymentExpiresAt: Date | null;
  /** Earliest moment a genuine transfer for this booking could exist. */
  bookingCreatedAt: Date | null;
  /** The shop's own receiving ids (PromptPay id, bank account no), unmasked. */
  receiverTargets: string[];
  provider: SlipProviderOutcome | null;
}

/** Tolerance between bank clock, our clock, and the customer's booking time. */
const CLOCK_SKEW_MS = 10 * 60_000;

const toSatang = (thb: number) => Math.round(thb * 100);

/**
 * Compare a provider's masked account ("xxx-x-x1234-x") with a full one.
 * Position-wise when the lengths agree; otherwise on the trailing visible digits.
 * Requires at least 4 visible digits — fewer is not evidence.
 */
export function maskedAccountMatches(masked: string, full: string): boolean {
  const maskedChars = masked.replace(/[^0-9xX*]/g, '').replace(/[X*]/g, 'x');
  const fullDigits = full.replace(/\D/g, '');
  const visible = maskedChars.replace(/x/g, '').length;
  if (visible < 4 || !fullDigits) return false;

  if (maskedChars.length === fullDigits.length) {
    return [...maskedChars].every((ch, i) => ch === 'x' || ch === fullDigits[i]);
  }
  // Different encodings of the same target (e.g. PromptPay phone as 0066…): fall back to the visible tail.
  const tail = maskedChars.match(/\d+$/)?.[0] ?? '';
  return tail.length >= 4 && fullDigits.endsWith(tail);
}

function evaluateProvider(input: SlipEvaluationInput, checks: SlipCheck[]): { confirmed: boolean; amount: number | null } {
  const outcome = input.provider;
  if (!outcome) {
    checks.push({ key: 'bank_found', status: 'skip', detail: 'ยังไม่ได้เชื่อมต่อระบบยืนยันกับธนาคาร — ยอดเงินและผู้รับยังไม่ถูกยืนยัน' });
    return { confirmed: false, amount: null };
  }
  if ('error' in outcome) {
    checks.push({ key: 'bank_found', status: 'warn', detail: 'ติดต่อระบบยืนยันกับธนาคารไม่สำเร็จ' });
    return { confirmed: false, amount: null };
  }

  const bank = outcome.result;
  if (!bank.found) {
    checks.push({ key: 'bank_found', status: 'fail', detail: 'ธนาคารไม่พบรายการโอนตามเลขอ้างอิงนี้' });
    return { confirmed: false, amount: null };
  }
  checks.push({ key: 'bank_found', status: 'pass', detail: 'ธนาคารยืนยันว่ามีรายการโอนนี้จริง' });

  const amountOk = bank.amountTHB !== null && toSatang(bank.amountTHB) === toSatang(input.expectedAmountTHB);
  checks.push({
    key: 'bank_amount',
    status: amountOk ? 'pass' : 'fail',
    detail: amountOk ? 'ยอดโอนตรงกับยอดที่ต้องชำระ' : `ยอดโอนจริง ${bank.amountTHB ?? '-'} บาท ไม่ตรงกับยอดที่ต้องชำระ`,
  });

  const receiverOk = Boolean(
    bank.receiverAccount && input.receiverTargets.some((target) => maskedAccountMatches(bank.receiverAccount as string, target)),
  );
  checks.push({
    key: 'bank_receiver',
    status: receiverOk ? 'pass' : 'fail',
    detail: receiverOk ? 'บัญชีผู้รับตรงกับบัญชีของร้าน' : 'บัญชีผู้รับไม่ตรงกับบัญชีของร้าน',
  });

  const transferredAt = bank.transferredAt ? new Date(bank.transferredAt) : null;
  const timeKnown = Boolean(transferredAt && !Number.isNaN(transferredAt.getTime()));
  const notBeforeBooking =
    !input.bookingCreatedAt || (timeKnown && (transferredAt as Date).getTime() >= input.bookingCreatedAt.getTime() - CLOCK_SKEW_MS);
  const notInFuture = timeKnown && (transferredAt as Date).getTime() <= input.uploadedAt.getTime() + CLOCK_SKEW_MS;
  const timeOk = timeKnown && notBeforeBooking && notInFuture;
  checks.push({
    key: 'bank_time',
    status: timeOk ? 'pass' : 'fail',
    detail: timeOk ? 'เวลาโอนอยู่ในช่วงของการจองนี้' : 'เวลาโอนไม่อยู่ในช่วงของการจองนี้ (อาจเป็นสลิปเก่า)',
  });

  return { confirmed: amountOk && receiverOk && timeOk, amount: bank.amountTHB };
}

/** Run every check and reduce them to one status plus the auto-approve decision. */
export function evaluateSlip(input: SlipEvaluationInput): SlipEvaluation {
  const checks: SlipCheck[] = [];
  const base = { verifiedAmountTHB: null, providerId: input.provider?.id ?? null };

  if (!input.qrPayload) {
    checks.push({ key: 'qr_found', status: 'warn', detail: 'อ่าน QR บนสลิปไม่ได้ (รูปไม่ชัด ถูกครอบ หรือสลิปไม่มี QR)' });
    return { status: 'unreadable', autoApprove: false, checks, ...base };
  }
  checks.push({ key: 'qr_found', status: 'pass', detail: 'พบ QR บนสลิป' });

  if (!input.parsed || !input.parsed.ok) {
    checks.push({ key: 'qr_format', status: 'warn', detail: 'QR ไม่ใช่รูปแบบสลิปโอนเงินมาตรฐาน ธปท.' });
    return { status: 'unreadable', autoApprove: false, checks, ...base };
  }
  const slip = input.parsed.slip;
  checks.push({ key: 'qr_format', status: 'pass', detail: `รูปแบบสลิปมาตรฐาน · เลขอ้างอิง ${slip.transRef}` });

  checks.push({
    key: 'qr_crc',
    status: slip.crcValid ? 'pass' : 'fail',
    detail: slip.crcValid ? 'ค่าตรวจสอบ (CRC) ของ QR ถูกต้อง' : 'ค่าตรวจสอบ (CRC) ของ QR ไม่ถูกต้อง — QR อาจถูกแก้ไข',
  });
  checks.push({
    key: 'country',
    status: slip.countryCode === 'TH' ? 'pass' : 'warn',
    detail: slip.countryCode === 'TH' ? 'สลิปจากธนาคารในประเทศไทย' : 'ไม่พบรหัสประเทศ TH ใน QR',
  });
  checks.push({
    key: 'sending_bank',
    status: slip.sendingBankName ? 'pass' : 'warn',
    detail: slip.sendingBankName ? `โอนจาก${slip.sendingBankName}` : `ไม่รู้จักรหัสธนาคาร ${slip.sendingBankCode}`,
  });
  checks.push({
    key: 'not_duplicate',
    status: input.duplicate ? 'fail' : 'pass',
    detail: input.duplicate ? 'เลขอ้างอิงนี้ถูกใช้กับรายการอื่นแล้ว — สลิปซ้ำ' : 'ยังไม่เคยมีการใช้สลิปนี้',
  });

  if (input.amountClaimedTHB === null) {
    checks.push({ key: 'amount_claimed', status: 'skip', detail: 'ลูกค้าไม่ได้ระบุยอดที่โอน' });
  } else {
    const claimedOk = toSatang(input.amountClaimedTHB) === toSatang(input.expectedAmountTHB);
    checks.push({
      key: 'amount_claimed',
      status: claimedOk ? 'pass' : 'warn',
      detail: claimedOk ? 'ยอดที่ลูกค้าแจ้งตรงกับยอดที่ต้องชำระ' : 'ยอดที่ลูกค้าแจ้งไม่ตรงกับยอดที่ต้องชำระ',
    });
  }

  const late = Boolean(input.paymentExpiresAt && input.uploadedAt.getTime() > input.paymentExpiresAt.getTime());
  checks.push({
    key: 'within_window',
    status: late ? 'warn' : 'pass',
    detail: late ? 'อัปโหลดหลังหมดเวลาชำระเงิน' : 'อัปโหลดภายในเวลาชำระเงิน',
  });

  const bank = evaluateProvider(input, checks);

  const failed = checks.some((c) => c.status === 'fail');
  if (failed) return { status: 'suspicious', autoApprove: false, checks, ...base, verifiedAmountTHB: bank.amount };

  // A claimed-amount typo does not block: the bank's answer outranks it. A late
  // upload does — the slot may already have been released, so a human decides.
  if (bank.confirmed) return { status: 'verified', autoApprove: !late, checks, ...base, verifiedAmountTHB: bank.amount };

  return { status: 'plausible', autoApprove: false, checks, ...base };
}
