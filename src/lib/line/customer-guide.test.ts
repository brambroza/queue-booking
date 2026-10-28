import { describe, expect, it } from 'vitest';
import {
  bookingButtonIndex,
  exampleConfirmBubble,
  exampleDays,
  isHexColor,
  guideFileName,
  lineAddFriendUrl,
  normalizeBasicId,
  sampleSlotTimes,
  serviceSubtitle,
} from './customer-guide';

describe('normalizeBasicId', () => {
  it('adds a single @', () => {
    expect(normalizeBasicId('123abcde')).toBe('@123abcde');
    expect(normalizeBasicId('@123abcde')).toBe('@123abcde');
    expect(normalizeBasicId('  @@shop.name ')).toBe('@shop.name');
  });

  it('rejects empty or odd input', () => {
    expect(normalizeBasicId(null)).toBeNull();
    expect(normalizeBasicId('')).toBeNull();
    expect(normalizeBasicId('@')).toBeNull();
    expect(normalizeBasicId('has space')).toBeNull();
    expect(normalizeBasicId('<script>')).toBeNull();
  });
});

describe('lineAddFriendUrl', () => {
  it('encodes the @', () => {
    expect(lineAddFriendUrl('@123abcde')).toBe('https://line.me/R/ti/p/%40123abcde');
    expect(lineAddFriendUrl('123abcde')).toBe('https://line.me/R/ti/p/%40123abcde');
  });

  it('returns null without an id', () => {
    expect(lineAddFriendUrl(undefined)).toBeNull();
  });
});

describe('bookingButtonIndex', () => {
  const btn = (type: string) => ({ iconKey: 'calendar', label: 'x', action: { type } }) as never;

  it('finds the booking button', () => {
    expect(bookingButtonIndex([btn('message'), btn('liff_member'), btn('liff_booking')])).toBe(2);
  });

  it('falls back to the first button', () => {
    expect(bookingButtonIndex([btn('message'), btn('liff_member')])).toBe(0);
  });
});

describe('serviceSubtitle', () => {
  it('joins duration and price', () => {
    expect(serviceSubtitle({ name: 'ตัดผม', durationMinutes: 60, price: 350 })).toBe('60 นาที · ฿350');
  });

  it('drops missing parts', () => {
    expect(serviceSubtitle({ name: 'x', durationMinutes: 30, price: 0 })).toBe('30 นาที');
    expect(serviceSubtitle({ name: 'x', durationMinutes: null, price: 1200 })).toBe('฿1,200');
    expect(serviceSubtitle({ name: 'x', durationMinutes: null, price: null })).toBe('');
  });
});

describe('sampleSlotTimes', () => {
  it('steps from open time by interval', () => {
    expect(sampleSlotTimes({ open_time: '09:00:00', close_time: '18:00:00', slot_interval_minutes: 60 }, 3)).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
  });

  it('skips the break', () => {
    expect(
      sampleSlotTimes(
        { open_time: '11:00', close_time: '15:00', slot_interval_minutes: 60, break_start: '12:00', break_end: '13:00' },
        3,
      ),
    ).toEqual(['11:00', '13:00', '14:00']);
  });

  it('treats 00:00 close as end of day', () => {
    expect(sampleSlotTimes({ open_time: '22:00', close_time: '00:00', slot_interval_minutes: 60 }, 6)).toEqual(['22:00', '23:00']);
  });

  it('falls back without hours', () => {
    expect(sampleSlotTimes(null, 2)).toEqual(['10:00', '10:30']);
    expect(sampleSlotTimes({ open_time: '18:00', close_time: '09:00', slot_interval_minutes: 30 }, 1)).toEqual(['10:00']);
  });
});

describe('guideFileName', () => {
  it('keeps ASCII only', () => {
    expect(guideFileName('SHOP-PDCLSQ')).toBe('line-booking-guide-shop-pdclsq.png');
    expect(guideFileName('ร้าน')).toBe('line-booking-guide.png');
    expect(guideFileName(null)).toBe('line-booking-guide.png');
  });
});

describe('isHexColor', () => {
  it('accepts #rrggbb only', () => {
    expect(isHexColor('#12a862')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe('exampleDays', () => {
  it('starts tomorrow on the Bangkok calendar', () => {
    // 2026-10-28 20:00 UTC = 29 Oct 03:00 in Bangkok, so "tomorrow" is the 30th.
    const days = exampleDays(new Date('2026-10-28T20:00:00Z'), 2);
    expect(days.map((d) => d.iso)).toEqual(['2026-10-30', '2026-10-31']);
    expect(days[0].day).toBe('30');
  });
});

describe('exampleConfirmBubble', () => {
  it('is the real confirmation bubble with the example picks', () => {
    const bubble = exampleConfirmBubble({ shopName: 'ร้านA', branchName: null, serviceName: 'ตัดผม', dateIso: '2026-10-30', time: '09:30' });
    const json = JSON.stringify(bubble);
    expect(bubble.type).toBe('bubble');
    expect(json).toContain('จองคิวสำเร็จ');
    expect(json).toContain('เลขคิว A001');
    expect(json).toContain('บริการ: ตัดผม');
    expect(json).toContain('สาขา: -');
    expect(json).toContain('เวลา: 09:30');
    expect(json).toContain('ยกเลิกคิว');
  });
});
