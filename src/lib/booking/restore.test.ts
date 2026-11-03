import { describe, expect, it } from 'vitest';
import { appendPaymentExpiredNote } from '@/lib/payments/payment-hold';
import {
  PAYMENT_EXPIRED_NOTE_MARKER,
  RESTORED_NOTE_MARKER,
  checkRestorable,
  isPaymentExpiredCancel,
  restoreGroup,
  restoreRefusedMessage,
  restoredNote,
} from './restore';

const TODAY = '2026-11-03';

describe('checkRestorable', () => {
  it('allows a cancelled booking for today or later', () => {
    expect(checkRestorable({ status: 'cancelled', booking_date: TODAY }, TODAY)).toEqual({ ok: true });
    expect(checkRestorable({ status: 'cancelled', booking_date: '2026-11-10', is_deleted: false }, TODAY)).toEqual({ ok: true });
  });

  it('refuses other statuses, deleted rows and past days', () => {
    expect(checkRestorable({ status: 'confirmed', booking_date: TODAY }, TODAY)).toEqual({ ok: false, reason: 'not_cancelled' });
    expect(checkRestorable({ status: 'no_show', booking_date: TODAY }, TODAY)).toEqual({ ok: false, reason: 'not_cancelled' });
    expect(checkRestorable({ status: 'cancelled', booking_date: TODAY, is_deleted: true }, TODAY)).toEqual({ ok: false, reason: 'deleted' });
    expect(checkRestorable({ status: 'cancelled', booking_date: '2026-11-02' }, TODAY)).toEqual({ ok: false, reason: 'past' });
  });

  it('has a Thai message for every reason', () => {
    for (const r of ['not_cancelled', 'deleted', 'past'] as const) expect(restoreRefusedMessage(r)).toMatch(/[ก-๙]/);
  });
});

describe('payment-expired note', () => {
  it('detects the cron marker', () => {
    expect(isPaymentExpiredCancel(appendPaymentExpiredNote('ลูกค้าขอโต๊ะริม'))).toBe(true);
    expect(isPaymentExpiredCancel('ลูกค้ายกเลิกเอง')).toBe(false);
    expect(isPaymentExpiredCancel(null)).toBe(false);
  });

  it('drops the expiry marker, keeps staff text, adds the restore marker once', () => {
    const cancelled = appendPaymentExpiredNote('ลูกค้าขอโต๊ะริม');
    expect(restoredNote(cancelled)).toBe(`ลูกค้าขอโต๊ะริม | ${RESTORED_NOTE_MARKER}`);
    expect(restoredNote(restoredNote(cancelled))).toBe(`ลูกค้าขอโต๊ะริม | ${RESTORED_NOTE_MARKER}`);
    expect(restoredNote(PAYMENT_EXPIRED_NOTE_MARKER)).toBe(RESTORED_NOTE_MARKER);
    expect(restoredNote(null)).toBe(RESTORED_NOTE_MARKER);
  });
});

describe('restoreGroup', () => {
  const target = { id: 'a', status: 'cancelled', booking_date: TODAY };
  it('adds cancelled siblings of the same order, target first', () => {
    const siblings = [
      target,
      { id: 'b', status: 'cancelled', booking_date: TODAY },
      { id: 'c', status: 'confirmed', booking_date: TODAY },
      { id: 'd', status: 'cancelled', booking_date: TODAY, is_deleted: true },
      { id: 'e', status: 'cancelled', booking_date: '2026-11-01' },
    ];
    expect(restoreGroup(target, siblings, TODAY).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('is the target alone without siblings', () => {
    expect(restoreGroup(target, [], TODAY)).toEqual([target]);
  });
});
