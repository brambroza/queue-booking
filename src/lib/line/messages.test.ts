import { describe, expect, it } from 'vitest';
import {
  bookingApprovedFlex,
  bookingCancelPromptFlex,
  bookingConfirmFlex,
  bookingReminderFlex,
  bookingSelfCancelledFlex,
  cancelBookingPostbackData,
} from './messages';

const BOOKING = '11111111-2222-3333-4444-555555555555';

type Action = { type: string; label: string; text?: string; uri?: string; data?: string; displayText?: string };
type FlexLike = { altText: string; contents: { footer: { contents: Array<{ action: Action }> } } };

function footerActions(flex: unknown): Action[] {
  return (flex as FlexLike).contents.footer.contents.map((c) => c.action);
}

const base = { shopName: 'ร้านดี', queueNumber: 'A012', branch: 'สาขาหลัก', service: 'ตัดผม', date: '25 ก.ย.', time: '10:30' };

describe('cancelBookingPostbackData', () => {
  it('encodes the booking id under the cancel action', () => {
    expect(cancelBookingPostbackData(BOOKING)).toBe(`action=cancel_booking&booking_id=${BOOKING}`);
  });
});

describe('bookingConfirmFlex', () => {
  it('uses a one-tap postback when bookingId is given', () => {
    const cancel = footerActions(bookingConfirmFlex({ ...base, bookingId: BOOKING })).find((a) => a.label === 'ยกเลิกคิว');
    expect(cancel).toMatchObject({ type: 'postback', data: `action=cancel_booking&booking_id=${BOOKING}`, displayText: 'ยกเลิกคิว A012' });
  });

  it('falls back to the legacy text message without bookingId', () => {
    const cancel = footerActions(bookingConfirmFlex(base)).find((a) => a.label === 'ยกเลิกคิว');
    expect(cancel).toEqual({ type: 'message', label: 'ยกเลิกคิว', text: 'ยกเลิกคิว' });
  });

  it('passes bookingId through the approved variant', () => {
    const cancel = footerActions(bookingApprovedFlex({ ...base, bookingId: BOOKING })).find((a) => a.label === 'ยกเลิกคิว');
    expect(cancel?.type).toBe('postback');
  });
});

describe('bookingReminderFlex', () => {
  it('adds the cancel postback between "ดูคิวของฉัน" and "ติดต่อเจ้าหน้าที่"', () => {
    const labels = footerActions(bookingReminderFlex({ ...base, minutesBefore: 30, liffUrl: 'https://liff.line.me/x', bookingId: BOOKING })).map((a) => a.label);
    expect(labels).toEqual(['ดูคิวของฉัน', 'ยกเลิกคิว', 'ติดต่อเจ้าหน้าที่']);
  });

  it('has no cancel button without bookingId', () => {
    const labels = footerActions(bookingReminderFlex({ ...base, minutesBefore: 30 })).map((a) => a.label);
    expect(labels).toEqual(['ติดต่อเจ้าหน้าที่']);
  });
});

describe('bookingCancelPromptFlex', () => {
  it('offers exactly one postback button that cancels the shown booking', () => {
    const actions = footerActions(bookingCancelPromptFlex({ ...base, bookingId: BOOKING, liffUrl: 'https://liff.line.me/x?tab=account' }));
    const postbacks = actions.filter((a) => a.type === 'postback');
    expect(postbacks).toHaveLength(1);
    expect(postbacks[0].data).toBe(`action=cancel_booking&booking_id=${BOOKING}`);
    expect(actions.find((a) => a.label === 'ดูคิวของฉัน')?.uri).toBe('https://liff.line.me/x?tab=account');
  });
});

describe('bookingSelfCancelledFlex', () => {
  it('names the queue and date in altText and offers rebooking when a LIFF url exists', () => {
    const flex = bookingSelfCancelledFlex({ shopName: 'ร้านดี', queueNumber: 'A012', date: '25 ก.ย.', time: '10:30', liffUrl: 'https://liff.line.me/x?tab=booking' });
    expect((flex as FlexLike).altText).toContain('A012');
    expect((flex as FlexLike).altText).toContain('25 ก.ย.');
    expect(footerActions(flex).map((a) => a.label)).toEqual(['จองคิวใหม่', 'ติดต่อเจ้าหน้าที่']);
  });

  it('omits "จองคิวใหม่" without a LIFF url', () => {
    const flex = bookingSelfCancelledFlex({ shopName: 'ร้านดี', queueNumber: 'A012', date: '25 ก.ย.', time: '10:30' });
    expect(footerActions(flex).map((a) => a.label)).toEqual(['ติดต่อเจ้าหน้าที่']);
  });
});
